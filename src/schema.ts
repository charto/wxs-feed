export const wfs = {
	document: [
		'GetFeature'
	],
	GetFeature: [
		'$maxFeatures',
		'$service',
		'Query[]'
	],
	Query: [
		'$srsName',
		'$typeName',
		'Filter'
	],
	Filter: [
		'BBOX',
		'Intersects'
	],
	BBOX: [
		'Envelope'
	],
	Intersects: [
		'Envelope'
	],
	Envelope: [
		'$srsName',
		'$typeName',
		{
			lowerCorner: 'string[]',
			upperCorner: 'string[]'
		}
	]
};
