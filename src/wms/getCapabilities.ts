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
			'<!DOCTYPE WMT_MS_Capabilities SYSTEM "http://schemas.opengis.net/wms/1.1.1/capabilities_1_1_1.dtd">',
			'<WMT_MS_Capabilities',
			' xmlns:xlink="http://www.w3.org/1999/xlink"',
			' version="1.1.1"',
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
				(srs: SrsSpec) => '<SRS>' + srs.name + '</SRS>'
			).join(''),
			!spec.layers ? '' : spec.layers.map(
				(layer: WmsLayer) => [
					'<Layer>',
					'<Name>', layer.name, '</Name>',
					'<Title>', layer.title || layer.name, '</Title>',
					!spec.srs ? '' : spec.srs.map(
						(srs: SrsSpec) => !srs.bbox ? '' : [
							'<BoundingBox',
							' SRS="', srs.name, '"',
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
			'</WMT_MS_Capabilities>'
		].join('');

		state.handler.sendString(state, 200, 'text/xml', output);
	});

	return(handled);
}