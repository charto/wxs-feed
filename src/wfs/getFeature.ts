// This file is part of wxs-feed, copyright (c) 2016-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as Promise from 'bluebird';
import * as cxml from 'cxml2';

import { safeParameter } from '../parseQuery';
import { WxState } from '../WxHandler';
import { WxError, WxErrorCode } from '../WxError';
import { SRS } from '../types/SRS';
import { RExp } from '../types/RExp';

import * as schema from '../schema';

export type BBox = [ number, number, number, number, number ];

export interface WfsGetFeatureSpec {
	query: any;
	typeName: string;
	srs: SRS;
	bbox: BBox | null;
	maxFeatures: number;
}

export interface WfsGetFeature {
	numberOfFeatures?: number;
}

const wfsFilterBuilder = new cxml.Builder(schema.wfs, schema.wfs.Filter);

function parseFilter(state: WxState) {
	const paramTbl = state.paramTbl || {};

	return(new Promise<any>((resolve, reject) => {
		if(paramTbl['filter']) {
			const parser = state.handler.parserConfig.createParser();
			parser.getConfig().bindNamespace(new cxml.Namespace('ogc', 'http://www.opengis.net/ogc'), 'xmlns');
			wfsFilterBuilder.build(parser, (doc: any) => {
				resolve(doc);
			});

			parser.write(paramTbl['filter']);
			parser.end();
		} else if(paramTbl['bbox']) {
			let parts = paramTbl['bbox'].split(',');

			if(parts.length < 4 || parts.length > 5) {
				throw(new WxError(WxErrorCode.invalidParameter, 'bbox', paramTbl['bbox']));
			}

			resolve({
				BBOX: {
					Envelope: {
						lowerCorner: [ parts[0], parts[1] ],
						upperCorner: [ parts[2], parts[3] ],
						srsName: parts[4] || 'EPSG:4326'
					}
				}
			});
		} else {
			resolve(null);
		}
	}));
}

export function wfsGetFeature(state: WxState) {
	const options = state.options;
	const handler = options.wfs && options.wfs.getFeature;

	if(!handler) {
		throw(new WxError(WxErrorCode.unsupportedOperation, 'GetFeature'));
	}

	const handled = parseFilter(state).then((filter: any) => {
		const paramTbl = state.paramTbl || {};

		const xml = state.xml || {
			GetFeature: {
				maxFeatures: paramTbl['maxfeatures'],
				Query: [{
					Filter: filter,
					srsName: paramTbl['srsname'],
					typeName: paramTbl['typename']
				}]
			}
		};

		if(!xml.GetFeature) {
			throw(new WxError(WxErrorCode.missingParameter, 'GetFeature'));
		}

		if(!xml.GetFeature.Query) {
			throw(new WxError(WxErrorCode.missingParameter, 'Query'));
		}

		let maxFeatures = options.defaultFeatures || 100;

		if(xml.GetFeature.maxFeatures) {
			maxFeatures = -1;

			if(xml.GetFeature.maxFeatures.match(/^[0-9]{1,9}$/)) {
				maxFeatures = +xml.GetFeature.maxFeatures;
			}

			if(maxFeatures < 0 || (options.maxFeatures && maxFeatures > options.maxFeatures)) {
				throw(new WxError(WxErrorCode.invalidParameter, 'maxFeatures', xml.GetFeature.maxFeatures));
			}
		}

		const allHandled = Promise.map(xml.GetFeature.Query, (query: any) => {
			let srs: SRS | null;
			let bbox: BBox | null;
			let filter = query.Filter;
			let envelope = filter && (
				(filter.BBOX && filter.BBOX.Envelope) ||
				(filter.Intersects && filter.Intersects.Envelope)
			);

			bbox = null;

			if(envelope) {
				const sw = envelope.lowerCorner;
				const ne = envelope.upperCorner;

				if(sw && ne) {
					srs = SRS.parse(envelope.srsName || 'EPSG:4326');
					if(!srs) {
						throw(new WxError(WxErrorCode.invalidParameter, 'srsName', envelope.srsName));
					}

					if(srs.oldXY) {
						bbox = [ +sw[0], +sw[1], +ne[0], +ne[1], srs.epsg ];
					} else {
						bbox = [ +sw[1], +sw[0], +ne[1], +ne[0], srs.epsg ];
					}
				}
			}

			const typeName = safeParameter(query.typeName);

			srs = SRS.parse(query.srsName || 'EPSG:4326');
			if(!srs) {
				throw(new WxError(WxErrorCode.invalidParameter, 'srsName', envelope.srsName));
			}

			return(handler(state, { query, typeName, srs, bbox, maxFeatures }));
		});

		return(allHandled);
	}).then((specList: WfsGetFeature[]) => {
		//state.handler.sendString(state, 200, 'text/plain', '');
	});

	return(handled);
}
