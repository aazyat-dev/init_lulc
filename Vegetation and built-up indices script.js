/************************************
 * 1. STUDY AREA
 ************************************/
var roi = ee.FeatureCollection("projects/ee-aazyat/assets/communes_tg").geometry();/* your ROI geometry here */;
Map.centerObject(roi, 11);

/************************************
 * 2. CLOUD MASKING (SENTINEL-2 L2A)
 ************************************/
function maskS2clouds(image) {
  var scl = image.select('SCL');

  // Remove clouds, cloud shadow, cirrus, snow
  var mask = scl
    .neq(3)   // cloud shadow
    .and(scl.neq(7))  // low prob cloud
    .and(scl.neq(8))  // medium prob cloud
    .and(scl.neq(9))  // high prob cloud
    .and(scl.neq(10)) // cirrus
    .and(scl.neq(11)); // snow

  return image.updateMask(mask)
              .copyProperties(image, ['system:time_start']);
}

/************************************
 * 3. LOAD SENTINEL-2 COLLECTION
 ************************************/
var s2 = ee.ImageCollection('COPERNICUS/S2_SR')
  .filterBounds(roi)
  .filterDate('2023-01-01', '2023-12-31')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
  .map(maskS2clouds);

/************************************
 * 4. MEDIAN COMPOSITE
 ************************************/
var image = s2.median().clip(roi);

/************************************
 * 5. RENAME BANDS (BEST PRACTICE)
 ************************************/
var img = image.select(
  ['B2','B3','B4','B8','B11'],
  ['BLUE','GREEN','RED','NIR','SWIR']
);

/************************************
 * 6. CALCULATE INDICES
 ************************************/

// NDVI
var ndvi = img.normalizedDifference(['NIR', 'RED'])
              .rename('NDVI');

// EVI
var evi = img.expression(
  '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))', {
    'NIR': img.select('NIR'),
    'RED': img.select('RED'),
    'BLUE': img.select('BLUE')
}).rename('EVI');

// SAVI (L = 0.5)
var savi = img.expression(
  '((NIR - RED) / (NIR + RED + L)) * (1 + L)', {
    'NIR': img.select('NIR'),
    'RED': img.select('RED'),
    'L': 0.5
}).rename('SAVI');

// NDBI
var ndbi = img.normalizedDifference(['SWIR', 'NIR'])
              .rename('NDBI');

/************************************
 * 7. VISUALIZATION
 ************************************/
Map.addLayer(ndvi, {min: -0.2, max: 0.8, palette: ['brown','yellow','green']}, 'NDVI');
Map.addLayer(evi, {min: 0, max: 0.6, palette: ['white','green']}, 'EVI');
Map.addLayer(savi, {min: 0, max: 0.6, palette: ['white','darkgreen']}, 'SAVI');
Map.addLayer(ndbi, {min: -0.5, max: 0.5, palette: ['green','white','red']}, 'NDBI');

/************************************
 * 8. GREEN SPACE EXTRACTION (OPTIONAL)
 ************************************/
var greenSpace = ndvi.gt(0.3)
  .and(ndbi.lt(0))
  .and(evi.gt(0.2))
  .selfMask();

Map.addLayer(greenSpace, {palette: ['#1B9E77']}, 'Urban Green Space');

/************************************
 * 9. EXPORT INDICES (GeoTIFF)
 ************************************/
Export.image.toDrive({
  image: ndvi,
  description: 'NDVI_Tangier_2023',
  region: roi,
  scale: 10,
  maxPixels: 1e13
});

Export.image.toDrive({
  image: evi,
  description: 'EVI_Tangier_2023',
  region: roi,
  scale: 10,
  maxPixels: 1e13
});

Export.image.toDrive({
  image: savi,
  description: 'SAVI_Tangier_2023',
  region: roi,
  scale: 10,
  maxPixels: 1e13
});

Export.image.toDrive({
  image: ndbi,
  description: 'NDBI_Tangier_2023',
  region: roi,
  scale: 10,
  maxPixels: 1e13
});

Export.image.toDrive({
  image: greenSpace,
  description: 'Urban_Green_Spaces_Tangier_2023',
  region: roi,
  scale: 10,
  maxPixels: 1e13
});
