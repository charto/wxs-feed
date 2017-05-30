// This file is part of wxs-feed, copyright (c) 2016-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as util from 'util';
import * as http from 'http';

import * as Promise from 'bluebird';
import * as cxml from 'cxml2';

import { wfsDescribeFeatureType } from './wfs/describeFeatureType';
import { wfsGetCapabilities } from './wfs/getCapabilities';
import { wfsGetFeature } from './wfs/getFeature';

import { wmsGetCapabilities } from './wms/getCapabilities';

import { parseQuery, getRawBody } from './parseQuery';
import { WxError, WxErrorCode } from './WxError';

/** Query URL total maximum encoded length, for safety. */
const maxQueryLength = 65535;

export interface WxHandlerOptions {
	/** Inspect the request to check if it should be parsed at all.
	  * Any truthy return value allows parsing the request and will be passed
	  * to further authentication steps. */
	authorizeUser?: (state: WxState) => any;
//	getFeature?: (options: { typeName: string, bbox?: BBox | null, xml?: wfs11.QueryType }) => any;
	describeFeatureType?: (state: WxState, typeName: string) => any;
	encoding?: string;
}

export interface WxState {
	req: http.IncomingMessage;
	res: http.ServerResponse;
	options: WxHandlerOptions;
	handler: WxHandler;
	paramTbl?: { [key: string]: string };
	request?: string;
	service?: string;
	authorization?: any;
}

export class WxHandler {

	constructor(public options: WxHandlerOptions) {
		const config = new cxml.ParserConfig();
		config.bindNamespace(cxml.anonymous);
		config.addNamespace(cxml.xml1998);

		this.parserConfig = config;
	}

	sendString(state: WxState, code: number, mimeType: string, body: string) {
		const encoding = state.options.encoding || 'utf-8';
		const data = new Buffer(body, encoding);

		state.res.writeHead(code, {
			'Content-Type': mimeType,
			'Content-Length': data.length,
			'Cache-Control': 'private'
		});

		state.res.end(data);
	}

	sendError(state: WxState, err: Error) {
		let isObj = err instanceof Error;
		const name = (isObj && err.name) || 'NoApplicableCode';
		const text = (isObj && err.message) || 'Unknown error';
		const code = isObj && (err as WxError).code;
		const locator = isObj && (err as WxError).locator;

		if(code > WxErrorCode.max) {
			this.sendString(state, code as number, 'text/plain', code + ' ' + text);
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

			this.sendString(state, 200, 'application/xml', output);
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
		const endpointStart = reqUrl.lastIndexOf('/', paramStart) + 1;

		// SECURITY: Strip evil characters to avoid injection attacks.
		const endpoint = decodeURIComponent(
			reqUrl.substr(endpointStart, paramStart - endpointStart)
		).replace(/[^A-Za-z]/g, '?');

		// TODO: Maybe check the endpoint.

		let paramTbl: { [ key: string ]: string } | undefined;

		// Parse query string.
		if(paramStart >= 0) {
			// SECURITY: drop unknown parameters,
			// and dangerous characters from most parameters.
			paramTbl = parseQuery(reqUrl, paramStart + 1, {
				filter: false,
				outputformat: true,
				request: true,
				service: true,
				typename: true
			});
		} else {
			paramStart = reqUrl.length;
			paramTbl = {};
		}

		state.paramTbl = paramTbl;

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

		const bodyParsed = Promise.resolve(authorized).then((auth: any) => {
			// SECURITY: Only parse authorized POST requests.
			if(!auth) throw(new WxError(403));

			state.authorization = auth;

			if(state.req.method == 'POST') {
				const stream = getRawBody(state.req);
				if(!stream) throw(new WxError(415));

				const parser = this.parserConfig.createParser();
				stream.pipe(parser);
				// return(xmlParser.parse(getRawBody(req), wfs11.document) as any);
			} else return(null);
		});

		return(bodyParsed.then((body: any) => {
			if(!request && !body) {
				throw(new WxError(WxErrorCode.missingParameter, 'request'));
			}

			state.res.end('');
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
			getcapabilities: wmsGetCapabilities
		}
	};

	parserConfig: cxml.ParserConfig;

}
