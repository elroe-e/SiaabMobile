insert into public.brands(name, slug) values
  ('Samsung', 'samsung'), ('Apple', 'apple'), ('Xiaomi', 'xiaomi'),
  ('Google', 'google'), ('OnePlus', 'oneplus'), ('OPPO', 'oppo'), ('Nothing', 'nothing')
on conflict (name) do nothing;

insert into public.phone_models(brand_id, name, slug, status, tagline, specs, spec_meta, specs_reviewed)
select b.id, seed.name, seed.slug, seed.status::public.model_status, seed.tagline, seed.specs,
       jsonb_build_object('review', jsonb_build_object('source', 'database', 'status', 'fetched', 'locked', false)),
       true
from (values
  ('Samsung','Galaxy S24 Ultra','samsung-galaxy-s24-ultra','available','A whole new level of brilliant.','{"display":{"sizeInches":6.8,"resolution":{"width":1440,"height":3120},"type":"AMOLED","refreshRateHz":120},"chipset":"Snapdragon 8 Gen 3","cpu":"Octa-core","gpu":"Adreno 750","rearCamera":[{"name":"Main","megapixels":200},{"name":"Ultra wide","megapixels":12},{"name":"Telephoto","megapixels":50}],"frontCamera":{"megapixels":12},"batteryMah":5000,"chargingWatts":45,"fiveG":true,"nfc":true,"esim":true,"os":"Android 14","dimensionsMm":{"height":162.3,"width":79,"depth":8.6},"weightGrams":232,"waterRating":"IP68"}'::jsonb),
  ('Apple','iPhone 15 Pro','apple-iphone-15-pro','available','Titanium. So strong. So light. So Pro.','{"display":{"sizeInches":6.1,"resolution":{"width":1179,"height":2556},"type":"OLED","refreshRateHz":120},"chipset":"Apple A17 Pro","cpu":"6-core CPU","gpu":"6-core GPU","rearCamera":[{"name":"Main","megapixels":48},{"name":"Ultra wide","megapixels":12},{"name":"Telephoto","megapixels":12}],"frontCamera":{"megapixels":12},"batteryMah":3274,"chargingWatts":27,"fiveG":true,"nfc":true,"esim":true,"os":"iOS 17","dimensionsMm":{"height":146.6,"width":70.6,"depth":8.25},"weightGrams":187,"waterRating":"IP68"}'::jsonb),
  ('Samsung','Galaxy A55 5G','samsung-galaxy-a55','available','A little more awesome every day.','{"display":{"sizeInches":6.6,"resolution":{"width":1080,"height":2340},"type":"Super AMOLED","refreshRateHz":120},"chipset":"Exynos 1480","cpu":"Octa-core","rearCamera":[{"name":"Main","megapixels":50},{"name":"Ultra wide","megapixels":12},{"name":"Macro","megapixels":5}],"frontCamera":{"megapixels":32},"batteryMah":5000,"chargingWatts":25,"fiveG":true,"nfc":true,"esim":false,"os":"Android 14","dimensionsMm":{"height":161.1,"width":77.4,"depth":8.2},"weightGrams":213,"waterRating":"IP67"}'::jsonb),
  ('Xiaomi','Redmi Note 13 Pro','xiaomi-redmi-note-13-pro','available','Make moments mega.','{"display":{"sizeInches":6.67,"resolution":{"width":1220,"height":2712},"type":"AMOLED","refreshRateHz":120},"chipset":"Snapdragon 7s Gen 2","cpu":"Octa-core","rearCamera":[{"name":"Main","megapixels":200},{"name":"Ultra wide","megapixels":8},{"name":"Macro","megapixels":2}],"frontCamera":{"megapixels":16},"batteryMah":5100,"chargingWatts":67,"fiveG":true,"nfc":true,"esim":false,"os":"Android 13","dimensionsMm":{"height":161.2,"width":74.2,"depth":8},"weightGrams":187,"waterRating":"IP54"}'::jsonb),
  ('Google','Pixel 8a','google-pixel-8a','available','Amazing photography. Helpful AI.','{"display":{"sizeInches":6.1,"resolution":{"width":1080,"height":2400},"type":"OLED","refreshRateHz":120},"chipset":"Google Tensor G3","cpu":"Nona-core","rearCamera":[{"name":"Main","megapixels":64},{"name":"Ultra wide","megapixels":13}],"frontCamera":{"megapixels":13},"batteryMah":4492,"chargingWatts":18,"fiveG":true,"nfc":true,"esim":true,"os":"Android 14","dimensionsMm":{"height":152.1,"width":72.7,"depth":8.9},"weightGrams":188,"waterRating":"IP67"}'::jsonb),
  ('Apple','iPhone 13','apple-iphone-13','available','A delightfully capable everyday iPhone.','{"display":{"sizeInches":6.1,"resolution":{"width":1170,"height":2532},"type":"OLED","refreshRateHz":60},"chipset":"Apple A15 Bionic","cpu":"6-core CPU","rearCamera":[{"name":"Main","megapixels":12},{"name":"Ultra wide","megapixels":12}],"frontCamera":{"megapixels":12},"batteryMah":3227,"chargingWatts":20,"fiveG":true,"nfc":true,"esim":true,"os":"iOS 15","dimensionsMm":{"height":146.7,"width":71.5,"depth":7.65},"weightGrams":174,"waterRating":"IP68"}'::jsonb),
  ('OnePlus','12','oneplus-12','available','Your best shot at the best shot.','{"display":{"sizeInches":6.82,"resolution":{"width":1440,"height":3168},"type":"LTPO AMOLED","refreshRateHz":120},"chipset":"Snapdragon 8 Gen 3","cpu":"Octa-core","rearCamera":[{"name":"Main","megapixels":50},{"name":"Ultra wide","megapixels":48},{"name":"Telephoto","megapixels":64}],"frontCamera":{"megapixels":32},"batteryMah":5400,"chargingWatts":100,"fiveG":true,"nfc":true,"esim":false,"os":"Android 14","dimensionsMm":{"height":164.3,"width":75.8,"depth":9.15},"weightGrams":220,"waterRating":"IP65"}'::jsonb),
  ('Xiaomi','Poco X6 Pro','poco-x6-pro','available','Speed meets super style.','{"display":{"sizeInches":6.67,"resolution":{"width":1220,"height":2712},"type":"AMOLED","refreshRateHz":120},"chipset":"Dimensity 8300 Ultra","cpu":"Octa-core","rearCamera":[{"name":"Main","megapixels":64},{"name":"Ultra wide","megapixels":8},{"name":"Macro","megapixels":2}],"frontCamera":{"megapixels":16},"batteryMah":5000,"chargingWatts":67,"fiveG":true,"nfc":true,"esim":false,"os":"Android 14","dimensionsMm":{"height":160.5,"width":74.3,"depth":8.25},"weightGrams":186,"waterRating":"IP54"}'::jsonb),
  ('Samsung','Galaxy A15','samsung-galaxy-a15','available','A little something for everyone.','{"display":{"sizeInches":6.5,"resolution":{"width":1080,"height":2340},"type":"Super AMOLED","refreshRateHz":90},"chipset":"MediaTek Helio G99","cpu":"Octa-core","rearCamera":[{"name":"Main","megapixels":50},{"name":"Ultra wide","megapixels":5},{"name":"Macro","megapixels":2}],"frontCamera":{"megapixels":13},"batteryMah":5000,"chargingWatts":25,"fiveG":false,"nfc":true,"esim":false,"os":"Android 14","dimensionsMm":{"height":160.1,"width":76.8,"depth":8.4},"weightGrams":200,"waterRating":null}'::jsonb),
  ('OPPO','Reno11 F','oppo-reno-11-f','available','The portrait expert.','{"display":{"sizeInches":6.7,"resolution":{"width":1080,"height":2412},"type":"AMOLED","refreshRateHz":120},"chipset":"Dimensity 7050","cpu":"Octa-core","rearCamera":[{"name":"Main","megapixels":64},{"name":"Ultra wide","megapixels":8},{"name":"Macro","megapixels":2}],"frontCamera":{"megapixels":32},"batteryMah":5000,"chargingWatts":67,"fiveG":true,"nfc":true,"esim":false,"os":"Android 14","dimensionsMm":{"height":161.1,"width":74.7,"depth":7.5},"weightGrams":177,"waterRating":"IP65"}'::jsonb),
  ('OnePlus','Nord CE4','oneplus-nord-ce4','available','All power. All day.','{"display":{"sizeInches":6.7,"resolution":{"width":1080,"height":2412},"type":"AMOLED","refreshRateHz":120},"chipset":"Snapdragon 7 Gen 3","cpu":"Octa-core","rearCamera":[{"name":"Main","megapixels":50},{"name":"Ultra wide","megapixels":8}],"frontCamera":{"megapixels":16},"batteryMah":5500,"chargingWatts":100,"fiveG":true,"nfc":true,"esim":false,"os":"Android 14","dimensionsMm":{"height":162.5,"width":75.3,"depth":8.4},"weightGrams":186,"waterRating":"IP54"}'::jsonb),
  ('Xiaomi','Redmi 12','xiaomi-redmi-12','available','More to love. More to see.','{"display":{"sizeInches":6.79,"resolution":{"width":1080,"height":2460},"type":"LCD","refreshRateHz":90},"chipset":"MediaTek Helio G88","cpu":"Octa-core","rearCamera":[{"name":"Main","megapixels":50},{"name":"Ultra wide","megapixels":8},{"name":"Macro","megapixels":2}],"frontCamera":{"megapixels":8},"batteryMah":5000,"chargingWatts":18,"fiveG":false,"nfc":true,"esim":false,"os":"Android 13","dimensionsMm":{"height":168.6,"width":76.3,"depth":8.2},"weightGrams":198,"waterRating":"IP53"}'::jsonb)
) as seed(brand,name,slug,status,tagline,specs)
join public.brands b on b.name = seed.brand
on conflict (slug) do nothing;

insert into public.phone_models(brand_id, name, slug, status, expected_date, expected_price_range, tagline, specs, spec_meta, specs_reviewed)
select b.id, seed.name, seed.slug, 'upcoming', seed.expected_date, seed.expected_price_range, seed.tagline, '{}'::jsonb,
       '{"review":{"source":"database","status":"missing","locked":false}}'::jsonb, true
from (values
  ('Apple','iPhone 16','apple-iphone-16','October 2026','Br 95,000–120,000','Expected release details are unconfirmed.'),
  ('Google','Pixel 10','google-pixel-10','November 2026','Br 65,000–90,000','Expected release details are unconfirmed.'),
  ('Samsung','Galaxy S26','samsung-galaxy-s26','Early 2027','Br 115,000–160,000','Expected release details are unconfirmed.'),
  ('Nothing','Phone (4)','nothing-phone-4','2027','To be announced','Expected release details are unconfirmed.')
) as seed(brand,name,slug,expected_date,expected_price_range,tagline)
join public.brands b on b.name = seed.brand
on conflict (slug) do nothing;

insert into public.variants(model_id, ram_gb, storage_gb, color_name, color_hex, price, old_price, stock_count, low_stock_threshold, is_published)
select m.id, seed.ram_gb, seed.storage_gb, seed.color_name, seed.color_hex, seed.price, seed.old_price, seed.stock, 2, true
from (values
  ('samsung-galaxy-s24-ultra',12,256,'Titanium Gray','#777b82',84999::numeric,89999::numeric,8),
  ('samsung-galaxy-s24-ultra',12,512,'Violet','#a99bc6',92999::numeric,null::numeric,4),
  ('apple-iphone-15-pro',8,128,'Natural Titanium','#c9c2b6',104999::numeric,null::numeric,2),
  ('apple-iphone-15-pro',8,256,'Blue Titanium','#7385a2',115999::numeric,null::numeric,3),
  ('samsung-galaxy-a55',8,128,'Navy','#253451',32999::numeric,null::numeric,14),
  ('samsung-galaxy-a55',8,256,'Ice Blue','#9cc8d6',36999::numeric,null::numeric,5),
  ('xiaomi-redmi-note-13-pro',8,256,'Midnight Black','#33363d',24999::numeric,26999::numeric,11),
  ('google-pixel-8a',8,128,'Obsidian','#30343d',41999::numeric,null::numeric,5),
  ('apple-iphone-13',4,128,'Midnight','#282d39',51999::numeric,null::numeric,6),
  ('oneplus-12',12,256,'Silky Black','#26282a',77999::numeric,null::numeric,4),
  ('poco-x6-pro',12,256,'Black','#24272c',29999::numeric,null::numeric,3),
  ('samsung-galaxy-a15',6,128,'Blue Black','#293745',13999::numeric,null::numeric,18),
  ('oppo-reno-11-f',8,256,'Ocean Blue','#3979b6',27999::numeric,null::numeric,7),
  ('oneplus-nord-ce4',8,128,'Dark Chrome','#44464e',28999::numeric,30999::numeric,9),
  ('xiaomi-redmi-12',4,128,'Sky Blue','#8cbdd1',10999::numeric,null::numeric,0)
) as seed(slug,ram_gb,storage_gb,color_name,color_hex,price,old_price,stock)
join public.phone_models m on m.slug = seed.slug
on conflict (model_id, ram_gb, storage_gb, color_name) do nothing;

insert into public.trade_in_values(model_id, brand_text, model_text, storage_gb, base_value)
select m.id, seed.brand, seed.model, seed.storage_gb, seed.base_value
from (values
  ('Apple','iPhone 15 Pro Max',256,56000::numeric),('Apple','iPhone 15 Pro',128,49000::numeric),
  ('Apple','iPhone 15',128,39000::numeric),('Apple','iPhone 14 Pro',128,40000::numeric),
  ('Apple','iPhone 14',128,30000::numeric),('Apple','iPhone 13',128,24000::numeric),
  ('Apple','iPhone 12',128,18000::numeric),('Apple','iPhone 11',64,12000::numeric),
  ('Samsung','Galaxy S24 Ultra',256,58000::numeric),('Samsung','Galaxy S24+',256,46000::numeric),
  ('Samsung','Galaxy S24',128,39000::numeric),('Samsung','Galaxy S23 Ultra',256,39000::numeric),
  ('Samsung','Galaxy S23',128,26000::numeric),('Samsung','Galaxy A55 5G',128,19000::numeric),
  ('Samsung','Galaxy A35 5G',128,14000::numeric),('Samsung','Galaxy A15',128,6500::numeric),
  ('Xiaomi','Xiaomi 14',256,35000::numeric),('Xiaomi','Redmi Note 13 Pro',256,16000::numeric),
  ('Xiaomi','Redmi Note 12 Pro',128,12000::numeric),('Xiaomi','Poco X6 Pro',256,18000::numeric),
  ('Xiaomi','Redmi 12',128,5500::numeric),('Google','Pixel 8 Pro',128,39000::numeric),
  ('Google','Pixel 8',128,29000::numeric),('Google','Pixel 7a',128,19000::numeric),
  ('OnePlus','OnePlus 12',256,43000::numeric),('OnePlus','Nord CE4',128,15000::numeric)
) as seed(brand,model,storage_gb,base_value)
left join public.phone_models m on m.name = seed.model and m.brand_id = (select b.id from public.brands b where b.name = seed.brand)
on conflict (brand_text, model_text, storage_gb) do nothing;
