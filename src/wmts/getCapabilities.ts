// This file is part of wxs-feed, copyright (c) 2016-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as Promise from 'bluebird';

import { WxState, guessEndpoint } from '../WxHandler';
import { WxError, WxErrorCode } from '../WxError';
import { BBox } from 'charto-types';

export interface WmtsGetCapabilities {
	title?: string;
	endpoint?: string;
}

export function wmtsGetCapabilities(state: WxState) {
	const handler = state.options.wmts && state.options.wmts.getCapabilities;

	if(!handler) {
		throw(new WxError(WxErrorCode.unsupportedOperation, 'GetCapabilities'));
	}

	const handled = Promise.try(() => handler(state)).then((spec: WmtsGetCapabilities | string | null) => {
		let output = '';

		if(!spec) {
			throw(new WxError(WxErrorCode.unsupportedOperation, 'GetCapabilities'));
		} else if(typeof(spec) == 'string') {
			output = spec;
		} else {
			let endpoint = spec.endpoint;

			if(!endpoint) {
				endpoint = guessEndpoint(state);
			}
		}

		state.handler.send(state, 200, 'text/xml; subtype=gml/3.1.1', output);
	});

	return(handled);
}
