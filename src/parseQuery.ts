// This file is part of wxs-feed, copyright (c) 2016-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as http from 'http';
import * as zlib from 'zlib';

/** Decompression algorithms for supported content encodings. */

const contentDecoderTbl: { [encoding: string]: (req: NodeJS.ReadableStream) => NodeJS.ReadableStream } = {
	'identity': (req: NodeJS.ReadableStream) => req,
	'deflate': (req: NodeJS.ReadableStream) => req.pipe(zlib.createInflate()),
	'gzip': (req: NodeJS.ReadableStream) => req.pipe(zlib.createGunzip())
};

/** Get request body as a decompressed stream. */

export function getRawBody(req: http.IncomingMessage) {
	const contentEncoding = (req.headers['content-encoding'] || 'identity').toLowerCase();
	const contentDecoder = contentDecoderTbl[contentEncoding];

	if(!contentDecoder) return(null);

	return(contentDecoder(req as any as NodeJS.ReadableStream));
}

/** querystring.parse equivalent that outputs keys in lowercase.
  * @param query Original query string.
  * @param pos Index of one past the ? character signaling start of parameters.
  * @param strictTbl Table with boolean flags whether parameter values should
  * have some dangerous characters removed.
  * If present, only listed parameters are parsed at all. */

export function parseQuery(query: string, pos: number, strictTbl?: { [ key: string ]: boolean }) {
	const paramTbl: { [key: string]: string } = {};
	let next = 0, delim = 0, eq = 0;
	let key: string, val: string;
	let strictFlag = false;

	do {
		next = query.indexOf('&', pos) + 1;
		delim = next || query.length + 1;
		eq = query.indexOf('=', pos) + 1;

		if(eq && eq < delim) {
			key = decodeURIComponent(query.substr(pos, eq - pos - 1)).toLowerCase();

			// SECURITY: Skip parameters with characters other than a-z.
			if(key.match(/^[a-z]+$/)) {
				if(strictTbl) strictFlag = strictTbl[key];

				if(strictFlag || strictFlag === false || strictFlag === 0) {
					val = decodeURIComponent(query.substr(eq, delim - eq - 1));
					if(strictFlag) val = val.replace(/[^-+,.:/_# 0-9A-Za-z]/g, '?');
					paramTbl[key] = val;
				}
			}
		}

		pos = next;
	} while(pos);

	return(paramTbl);
}
