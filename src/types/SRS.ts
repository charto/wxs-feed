// This file is part of wxs-feed, copyright (c) 2016-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

import { RExp } from './RExp';

export class SRS {
	constructor(epsg: number) {
		this.epsg = epsg;
	}

	static parse(urn?: string, code?: number) {
		/*
			Examples:
			EPSG:4326
			http://www.opengis.net/gml/srs/epsg.xml#4326
			urn:ogc:def:crs:epsg::4326
			urn:x-ogc:def:crs:epsg:6.11.2:4326
			urn:ogc:def:crs:EPSG:7.4:4326
		*/
		if(!urn) return(null);
		let kind: string;

		if(!code) {
			const match = RExp.crs.epsg.exec(urn.toLowerCase());
			if(!match) return(null);
			kind = match[1];
			code = +match[2];
		} else kind = urn.toLowerCase();

		const srs = new SRS(code);

		srs.oldXY = (kind == 'epsg:' || kind == 'http://www.opengis.net/gml/srs/epsg.xml#');

		return(srs);
	}

	epsg: number;
	/** Flip X and Y coordinates when an old style EPSG code is used. */
	oldXY: boolean;
}
