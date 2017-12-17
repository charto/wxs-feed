// This file is part of wxs-feed, copyright (c) 2016-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as Promise from 'bluebird';
import * as stream from 'stream';

import { BBox, SRS } from 'charto-types';
import { WxState } from '../WxHandler';
import { WxError, WxErrorCode } from '../WxError';

export interface WmsGetMapSpec {
	layer: string;
	srs: SRS;
	bbox: BBox;
	width: number;
	height: number;
}

export interface WmsGetMap {
	buffer?: Buffer;
	mime: string;
	stream?: stream.Readable;
}

export function wmsGetMap(state: WxState) {
	const handler = state.options.wms && state.options.wms.getMap;

	if(!handler) {
		throw(new WxError(WxErrorCode.unsupportedOperation, 'GetMap'));
	}

	const handled = Promise.try(() => {
		let parts: string[] = [];
		const paramTbl = state.paramTbl || {};

		if(paramTbl['bbox']) {
			parts = paramTbl['bbox'].split(',');

			if(parts.length < 4 || parts.length > 5) {
				throw(new WxError(WxErrorCode.invalidParameter, 'bbox', paramTbl['bbox']));
			}
		}

		const srsName = paramTbl['crs'] || paramTbl['srs'];

		const xml = state.xml || {
			GetMap: {
				StyledLayerDescriptor: {
					NamedLayer: {
						Name: paramTbl['layers'],
						NamedStyle: paramTbl['styles']
					}
				},
				BoundingBox: {
					coord: [
						{ X: parts[0], Y: parts[1] },
						{ X: parts[2], Y: parts[3] }
					],
					srsName: parts[4] || srsName || 'EPSG:4326'
				},
				Output: {
					Format: paramTbl['format'],
					Size: {
						Width: paramTbl['width'],
						Height: paramTbl['height']
					}
				}
			}
		};

		const bboxSpec = xml.GetMap && xml.GetMap.BoundingBox;

		let srs = SRS.parse(bboxSpec.srsName)!;

		parts[0] = bboxSpec.coord[0].X;
		parts[1] = bboxSpec.coord[0].Y;
		parts[2] = bboxSpec.coord[1].X;
		parts[3] = bboxSpec.coord[1].Y;

		const bbox = BBox.fromArray(parts, srs);

		const layer = xml.GetMap && xml.GetMap.StyledLayerDescriptor && xml.GetMap.StyledLayerDescriptor.NamedLayer && xml.GetMap.StyledLayerDescriptor.NamedLayer.Name;
		const size = xml.GetMap && xml.GetMap.Output && xml.GetMap.Output.Size;
		const width = size.Width;
		const height = size.Height;

		srs = SRS.parse(srsName || bboxSpec.srsName || 'EPSG:4326')!;

		return(handler(state, { layer, srs, bbox, width, height }));
	}).then((spec: WmsGetMap) => {
		if(spec.stream) {
			state.res.writeHead(200, {
				'Content-Type': spec.mime,
				'Cache-Control': 'private'
			});

			spec.stream.pipe(state.res);
		} else if(spec.buffer) {
			state.handler.send(state, 200, spec.mime, spec.buffer!);
		}
	});

	return(handled);
}
