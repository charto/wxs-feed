// This file is part of wxs-feed, copyright (c) 2016 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import * as http from 'http';

import {handleWxS} from './handleWxS';

export class WxServer {
	constructor(options?: any) {
		if(!options) options = {};
		this.options = options;

		this.server = http.createServer(
			(
				req: http.IncomingMessage,
				res: http.ServerResponse
			) => handleWxS(req, res, options)
		);
	}

	/** Bind the server to a port. */

	listen(port: number) {
		return(new Promise((resolve: () => void, reject: (err: NodeJS.ErrnoException) => void) =>
			this.server.listen(port, resolve).on('error', reject)
		));
	}

	server: http.Server;
	options: any;
}
