// This file is part of wxs-feed, copyright (c) 2016-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as Promise from 'bluebird';

import { WxState } from '../WxHandler';
import { WxError, WxErrorCode } from '../WxError';

export interface WmsLayer {
	name: string;
	title?: string;
	srs?: any;
}

export interface SrsSpec {
	name: string;
	bbox: { n: number, e: number, s: number, w: number }
}

export interface WmsGetCapabilities {
	name?: string;
	title?: string;
	endpoint?: string;
	srs?: SrsSpec[];
	formats?: { [operation: string]: string[] };
	layers?: WmsLayer[];
}

export function wmsGetCapabilities(state: WxState) {
	const handler = state.options.wms && state.options.wms.getCapabilities;

	if(!handler) {
		throw(new WxError(WxErrorCode.unsupportedOperation, 'GetCapabilities'));
	}

	const handled = Promise.try(() => handler(state)).then((spec: WmsGetCapabilities) => {
		let target: string | undefined;
		let endpoint = spec.endpoint;

		if(!endpoint) {
			endpoint = [
				state.req.headers['X-Forwarded-Protocol'] || 'http',
				'://',
				state.req.headers.host,
				state.req.url!.substr(0, state.paramStart)
			].join('');
		}

		const output = [
			'<?xml version="1.0" encoding="UTF-8"?>',
			'<WMS_Capabilities',
			' xmlns="http://www.opengis.net/wms"',
			' xmlns:xlink="http://www.w3.org/1999/xlink"',
			' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
			' xsi:schemaLocation="http://www.opengis.net/wms http://schemas.opengis.net/wms/1.3.0/capabilities_1_3_0.xsd"'+
			' version="1.3.0"',
			'>',
			'<Service>',
			!spec.name ? '' : '<Name>' + spec.name + '</Name>',
			!spec.title ? '' : '<Title>' + spec.title + '</Title>',
			'</Service>',

			'<Capability>',

			'<Request>',
			['GetCapabilities', 'GetMap', 'GetFeatureInfo'].map(
				(operation: string) => !state.options.wms || !state.options.wms[
					operation.charAt(0).toLowerCase() + operation.substr(1)
				] ? '' : [
					'<' + operation + '>',
					((spec.formats || {})[operation] || []).map((mime: string) => '<Format>' + mime + '</Format>'),
					'<DCPType><HTTP>',
					'<Get>',
					'<OnlineResource xlink:type="simple" xlink:href="' + endpoint + '"/>',
					'</Get>',
					'</HTTP></DCPType>',
					'</' + operation + '>'
				].join('')
			).join(''),
			'</Request>',

			'<Layer>',
			!spec.title ? '' : '<Title>' + spec.title + '</Title>',
			!spec.srs ? '' : spec.srs.map(
				(srs: SrsSpec) => '<CRS>' + srs.name + '</CRS>'
			).join(''),
			!spec.layers ? '' : spec.layers.map(
				(layer: WmsLayer) => [
					'<Layer>',
					'<Name>', layer.name, '</Name>',
					'<Title>', layer.title || layer.name, '</Title>',
					!spec.srs ? '' : spec.srs.map(
						(srs: SrsSpec) => !srs.bbox ? '' : [
							'<CRS>' + srs.name + '</CRS>',
							'<BoundingBox',
							' CRS="', srs.name, '"',
							' minx="', srs.bbox.w, '"',
							' miny="', srs.bbox.s, '"',
							' maxx="', srs.bbox.e, '"',
							' maxy="', srs.bbox.n, '"',
							'/>'
						].join('')
					).join(''),
					'</Layer>'
				].join('')
			).join(''),
			'</Layer>',

			'</Capability>',
			'</WMS_Capabilities>'
		].join('');

		state.handler.send(state, 200, 'text/xml', output);
	});

	return(handled);
}
