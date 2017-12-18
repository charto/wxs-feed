// This file is part of wxs-feed, copyright (c) 2016-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as util from 'util';
import * as http from 'http';

import * as Promise from 'bluebird';
import * as cxml from 'cxml';

import { wfsDescribeFeatureType, WfsDescribeFeatureType } from './wfs/describeFeatureType';
import { wfsGetCapabilities, WfsGetCapabilities } from './wfs/getCapabilities';
import { wfsGetFeature, WfsGetFeatureSpec, WfsGetFeature } from './wfs/getFeature';

import { wmsGetCapabilities, WmsGetCapabilities } from './wms/getCapabilities';
import { wmsGetMap, WmsGetMapSpec, WmsGetMap } from './wms/getMap';

import { parseQuery, getRawBody } from './parseQuery';
import { WxError, WxErrorCode } from './WxError';

import schema = require('../schema.json');

/** Query URL total maximum encoded length, for safety. */
const maxQueryLength = 65535;

export interface WxHandlerOptions {
	/** Inspect the request to check if it should be parsed at all.
	  * Any truthy return value allows parsing the request and will be passed
	  * to further authentication steps. */
	authorizeUser?: (state: WxState) => any;
	/** Default maxFeatures parameter. */
	defaultFeatures?: number;
	/** Maximum allowed maxFeatures parameter. */
	maxFeatures?: number;
	encoding?: string;
	wfs?: {
		[ key: string ]: ((state: WxState, ...args: any[]) => any) | undefined,
		getCapabilities?: (state: WxState) => WfsGetCapabilities | null,
		describeFeatureType?: (state: WxState, typeName: string) => WfsDescribeFeatureType | null | Promise<WfsDescribeFeatureType | null>,
		getFeature?: (state: WxState, spec: WfsGetFeatureSpec) => WfsGetFeature | Promise<WfsGetFeature>
	};
	wms?: {
		[ key: string ]: ((state: WxState, ...args: any[]) => any) | undefined,
		getCapabilities?: (state: WxState) => WmsGetCapabilities,
		getMap?: (state: WxState, spec: WmsGetMapSpec) => WmsGetMap | Promise<WmsGetMap>
	};
}

export interface WxState {
	authorization?: any;
	endpoint?: string;
	req: http.IncomingMessage;
	res: http.ServerResponse;
	handler: WxHandler;
	options: WxHandlerOptions;
	paramStart?: number;
	paramTbl?: { [key: string]: string };
	path?: string;
	request?: string;
	service?: string;
	xml?: any;
}

export function guessEndpoint(state: WxState) {
	return(
		(
			state.req.headers['X-Forwarded-Protocol'] ||
			state.req.headers['x-forwarded-protocol'] ||
			state.req.headers['X-Forwarded-Proto'] ||
			state.req.headers['x-forwarded-proto'] ||
			'http'
		) +
		'://' +
		state.req.headers.host +
		state.req.url!.substr(0, state.paramStart)
	);
}

export class WxHandler {

	constructor(public options: WxHandlerOptions) {
		// TODO: remove the parseUnknown flag after integrating cxsd.
		this.xmlConfig = new cxml.ParserConfig({ parseUnknown: true });

		this.xmlConfig.bindNamespace(cxml.anonymous);
		this.xmlConfig.bindNamespace(cxml.xml1998);

		this.xmlBuilder = new cxml.Builder(this.xmlConfig, schema);
	}

	send(state: WxState, code: number, mimeType: string, body: string | Buffer) {
		if(typeof(body) == 'string') {
			const encoding = state.options.encoding || 'utf-8';
			body = new Buffer(body, encoding);
		}

		state.res.writeHead(code, {
			'Content-Type': mimeType,
			'Content-Length': body.length,
			'Cache-Control': 'private'
		});

		state.res.end(body);
	}

	sendError(state: WxState, err: Error) {
		let isObj = err instanceof Error;
		const name = (isObj && err.name) || 'NoApplicableCode';
		const text = (isObj && err.message) || 'Unknown error';
		const code = isObj && (err as WxError).code;
		const locator = isObj && (err as WxError).locator;

		if(code > WxErrorCode.max) {
			this.send(state, code as number, 'text/plain', code + ' ' + text);
		} else {
			const output = [
				'<?xml version="1.0" encoding="UTF-8"?>',
				'<ows:ExceptionReport',
				' xmlns:ows="http://www.opengis.net/ows"',
				' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
				' version="1.0.0"',
				' xsi:schemaLocation="http://www.opengis.net/ows"',
				'>',
				'<ows:Exception',
				' exceptionCode="', name, '"',
				locator ? ' locator="' + locator + '"' : '',
				'>',
				'<ows:ExceptionText>', text, '</ows:ExceptionText>',
				'</ows:Exception>',
				'</ows:ExceptionReport>'
			].join('');

			this.send(state, 200, 'application/xml', output);
		}
	}

	handle(state: WxState) {
		const options = state.options;
		const reqUrl = state.req.url!;

		if(reqUrl.length > maxQueryLength) {
			// SECURITY: Reject too long queries.
			throw(new WxError(WxErrorCode.other, null, 'Query string is too long'));
		}

		let paramStart = reqUrl.indexOf('?');
		let paramTbl: { [ key: string ]: string } | undefined;

		// Parse query string.
		if(paramStart >= 0) {
			// SECURITY: drop unknown parameters,
			// and dangerous characters from most parameters.
			paramTbl = parseQuery(reqUrl, paramStart + 1, {
				bbox: true,
				crs: true,
				filter: false,
				format: true,
				height: true,
				layers: true,
				maxfeatures: true,
				outputformat: true,
				request: true,
				service: true,
				srs: true,
				srsname: true,
				styles: true,
				typename: true,
				version: true,
				width: true
			});
		} else {
			paramStart = reqUrl.length;
			paramTbl = {};
		}

		state.paramStart = paramStart;
		state.paramTbl = paramTbl;

		const endpointStart = reqUrl.lastIndexOf('/', paramStart);

		if(endpointStart < 0) {
			throw(new WxError(404));
		}

		// SECURITY: Strip evil characters to avoid injection attacks.
		const endpoint = decodeURIComponent(
			reqUrl.substr(endpointStart + 1, paramStart - endpointStart - 1)
		).replace(/[^A-Za-z]/g, '?');

		state.endpoint = endpoint;
		state.path = reqUrl.substr(0, endpointStart);

		// TODO: Maybe check the endpoint.

		// SECURITY: Validate service.
		const service = (paramTbl['service'] || endpoint).toLowerCase();

		let handlerTbl = this.serviceTbl[service];
		if(!handlerTbl) {
			throw(new WxError(WxErrorCode.invalidParameter, 'service', service));
		}

		state.service = service;

		// SECURITY: Validate request type.
		let request = paramTbl['request'];
		let handler: (state: WxState) => void;

		if(request) {
			request = request.toLowerCase();
			handler = handlerTbl[request];

			if(!handler) {
				throw(new WxError(WxErrorCode.invalidParameter, 'request', request));
			}

			state.request = request;

			if(request == 'getcapabilities') {
				// SECURITY: Allow GetCapabilities without authorization,
				// but don't parse the rest of the query.
				return(handler(state));
			}
		} else if(state.req.method != 'POST') {
			throw(new WxError(WxErrorCode.missingParameter, 'request'));
		}

		// SECURITY: Avoid handling unauthorized requests.
		const authorized = !options.authorizeUser || options.authorizeUser(state);

		const bodyParsed = Promise.resolve(authorized).then<any>((auth: any) => {
			// SECURITY: Only parse authorized POST requests.
			if(!auth) throw(new WxError(403));

			state.authorization = auth;

			if(state.req.method == 'POST') {
				return(new Promise((resolve, reject) => {
					const stream = getRawBody(state.req);
					if(!stream) throw(new WxError(415));

					const parser = this.xmlConfig.createParser();
					this.xmlBuilder.build(parser, 'http://www.opengis.net/wfs', (doc: any) => {
						resolve(doc);
					});

					stream.pipe(parser);
				}));
			} else return(null);
		});

		return(bodyParsed.then((body: any) => {
			if(!request) {
				const keys = body && Object.keys(body);
				if(!keys || keys.length < 1) {
					throw(new WxError(WxErrorCode.missingParameter, 'request'));
				}

				// SECURITY: Validate request type.
				request = keys[0].toLowerCase();
				handler = handlerTbl[request];

				if(!handler) {
					throw(new WxError(WxErrorCode.invalidParameter, 'request', request));
				}

				state.request = request;
			}

			state.xml = body;

			return(handler(state));
		}));
	}

	tryHandle(req: http.IncomingMessage, res: http.ServerResponse) {
		const options = this.options;
		const state: WxState = { req, res, options, handler: this };

		return(Promise.try(
			() => this.handle(state)
		).catch(
			(err: any) => this.sendError(state, err)
		));
	}

	serviceTbl: { [ service: string ]:
		{ [ request: string ]: (state: WxState) => void }
	} = {
		wfs: {
			describefeaturetype: wfsDescribeFeatureType,
			getcapabilities: wfsGetCapabilities,
			getfeature: wfsGetFeature
		},
		wms: {
			getcapabilities: wmsGetCapabilities,
			getmap: wmsGetMap
		}
	};

	xmlConfig: cxml.ParserConfig;
	xmlBuilder: cxml.Builder;

}
