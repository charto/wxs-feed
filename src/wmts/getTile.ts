// This file is part of wxs-feed, copyright (c) 2016-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as stream from 'stream';

import * as Promise from 'bluebird';
import * as cxml from 'cxml';

import { safeParameter } from '../parseQuery';
import { WxState } from '../WxHandler';
import { WxError, WxErrorCode } from '../WxError';
import { BBox, SRS } from 'charto-types';

import schema = require('../../schema.json');

export interface WmtsGetTileSpec {
	layer: string;
	style: string;
	matrix: string;
	level: string;
	row: string;
	col: string;
}

export function wmtsGetTile(state: WxState) {
	const options = state.options;
	const handler = options.wmts && options.wmts.getTile;

	if(!handler) {
		throw(new WxError(WxErrorCode.unsupportedOperation, 'GetTile'));
	}

	const paramTbl = state.paramTbl || {};

	const { layer, style, tilematrix, tilerow, tilecol } = paramTbl;

	if(!layer) {
		throw(new WxError(WxErrorCode.missingParameter, 'Layer'));
	}

	const handled = Promise.try(
		() => handler(state, { layer, style, matrix: '', level: tilematrix, row: tilerow, col: tilecol })
	).then((result: any) => {
		if(result.pipe) {
			result.pipe(state.res);
		} else {
			throw(new WxError(500));
		}
	});

	return(handled);
}
