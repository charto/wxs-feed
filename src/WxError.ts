// This file is part of wxs-feed, copyright (c) 2016-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as http from 'http';

export const enum WxErrorCode {
	unsupportedOperation = 0,
	missingParameter,
	invalidParameter,
	unsupportedOption,
	other,
	max
}

const operationErrorNameTbl: { [ code: number /* WxErrorCode */ ]: string } = [
	'OperationNotSupported',
	'MissingParameterValue',
	'InvalidParameterValue',
	'OptionNotSupported',
	'NoApplicableCode'
];

export class WxError extends Error {
	constructor(code: WxErrorCode | number, locator?: string | null, message?: string) {
		switch(code) {
			case WxErrorCode.unsupportedOperation:

				message = 'Unsupported operation ' + locator;
				break;

			case WxErrorCode.missingParameter:

				message = 'Missing parameter ' + locator;
				break;

			case WxErrorCode.invalidParameter:

				message = 'Invalid parameter ' + locator + ': ' + message;
				break;

			default:

				if(code > WxErrorCode.max) message = http.STATUS_CODES[code];
		}

		super(message);

		this.code = code;
		this.locator = locator;
		this.name = operationErrorNameTbl[code] || 'Error';
	}

	code: WxErrorCode | number;
	locator?: string | null;
}
