// This file is part of wxs-feed, copyright (c) 2016-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as Promise from 'bluebird';

import { WxState } from '../WxHandler';
import { WxError, WxErrorCode } from '../WxError';

export interface WmsGetMap {
}

export function wmsGetMap(state: WxState) {
	const handler = state.options.wms && state.options.wms.getMap;

	if(!handler) {
		throw(new WxError(WxErrorCode.unsupportedOperation, 'GetMap'));
	}

	const handled = Promise.try(() => handler(state)).then((spec: WmsGetMap) => {
		state.handler.sendString(state, 200, 'text/plain', '');
	});

	return(handled);
}
