// This file is part of wxs-feed, copyright (c) 2016-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as Promise from 'bluebird';

import { WxState } from '../WxHandler';
import { WxError, WxErrorCode } from '../WxError';

export interface WfsGetFeature {
}

export function wfsGetFeature(state: WxState) {
	const handler = state.options.wfs && state.options.wfs.getFeature;

	if(!handler) {
		throw(new WxError(WxErrorCode.unsupportedOperation, 'GetFeature'));
	}

	const handled = Promise.try(() => handler(state)).then((spec: WfsGetFeature) => {
		state.handler.sendString(state, 200, 'text/plain', '');
	});

	return(handled);
}
