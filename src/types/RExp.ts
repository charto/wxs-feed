// This file is part of wxs-feed, copyright (c) 2016-2017 BusFaster Ltd.
// Released under the MIT license, see LICENSE.

const rePart = {
	number: (
		'[-+]?' + // Optional sign.
		'(?:[0-9]{0,32}\\.)?' + // Optionally up to 32 decimal digits of mantissa.
		'[0-9]{1,32}' + // Up to 32 decimal digits of integer or fraction.
		'(?:[Ee][-+]?[1-2]?[0-9])?' // Optional 2-digit exponent for scientific notation.
	),
	epsg: (
		'(' +
			'epsg:|' + // Old style.
			'http:\\/\\/www.opengis.net\\/gml\\/srs\\/epsg.xml#|' + // URL.
			'urn:(?:x-)?ogc:def:crs:epsg:[.0-9]*:' + // URN.
		')' +
		'([0-9]{1,8})' // Actual numeric code.
	)
};

export const RExp = {
	number: new RegExp('^' + rePart.number + '$'),
	bbox: new RegExp(
		'^((?:' + // Match coordinates (comma-separated numbers).
			'(?:^|,)' + // Number must be at the beginning or after a comma.
			rePart.number +
		'){4})' + // Exactly 4 coordinates define a box.
		'(?:,' +
			rePart.epsg +
		')?$',
		'i' // Coordinate system part is case insensitive.
	),
	crs: {
		epsg: new RegExp('^' + rePart.epsg + '$', 'i')
	}
};
