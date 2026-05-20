ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_item_type_check;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_item_type_check CHECK (item_type IN ('course','ebook','tokens'));

CREATE TEMP TABLE _qb_base (sid uuid, seq int, q text, c text, w1 text, w2 text, w3 text, e text);
INSERT INTO _qb_base VALUES
('73246f68-0d3c-45d4-95f5-07698eb47537',0,'Which natural fiber has the highest tensile strength?','Silk','Cotton','Wool','Jute','Silk reaches ~5 g/den.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',1,'Ginning removes','seeds from cotton','dirt from wool','gum from silk','husk from jute','Separates fibers from seeds.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',2,'English count Ne is','hanks of 840 yd per pound','m per g','kg per km','yd per oz','Ne = 840-yd hanks per lb.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',3,'Tex is','grams per 1000 metres','yd per lb','m per g','grains per yd','Direct count g/1000m.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',4,'Blowroom mainly','opens and cleans fibers','spins yarn','winds bobbins','dyes fibers','Removes trash.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',5,'Carding is the heart of','spinning','weaving','knitting','dyeing','Individualizes fibers.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',6,'Combing removes','short fibers','twist','weight','color','Removes noils.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',7,'Drafting means','attenuation of sliver','adding twist','cutting','blending color','Reduces density.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',8,'Ring frame inserts','twist','color','moisture','sizing','Drafts and twists.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',9,'TPI stands for','Twist Per Inch','Tex Per Inch','Tow Per Inch','Tension Per Inch','Twists per inch.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',10,'TM controls','yarn strength and hand','color','fiber length','bale weight','TM=TPI/sqrt(Ne).'),
('73246f68-0d3c-45d4-95f5-07698eb47537',11,'Open-end is also called','rotor spinning','ring','mule','cap','Rotor-based.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',12,'Air-jet spinning uses','compressed air','water','magnets','steam','Air vortex twist.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',13,'Neps are','entangled short fibers','dye spots','sizing','long fibers','Fiber knots.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',14,'Micronaire measures','fineness of cotton','length','color','strength','Fineness.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',15,'Staple length is','average fiber length','yarn length','roving length','bobbin length','Classifies cotton.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',16,'Ne 30 yarn means','30 hanks of 840 yd per lb','30 g/km','30 m/g','30 yd/oz','Higher Ne finer.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',17,'Roving is made on','speed frame','ring frame','draw frame','comber','Simplex.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',18,'Autoleveller ensures','uniform sliver','twist','dyeing','cutting','Corrects mass.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',19,'Nm 50 equals','50 m per gram','50 hanks/lb','50 g/km','50 tex','Metric count.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',20,'Denier equals','grams per 9000 m','g per 100m','g/km','kg/km','Filament count.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',21,'Mule spins','woollen yarn','silk','jute','cotton','Soft lofty.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',22,'CV percent indicates','evenness','color','ply','twist','Lower better.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',23,'Hairiness measured by','Uster','GSM tester','Pilling tester','Bursting tester','H value.'),
('73246f68-0d3c-45d4-95f5-07698eb47537',24,'Compact spinning improves','strength and reduces hairiness','absorbency','bulk','fastness','Suction zone.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',0,'Warping winds','parallel yarns on a beam','weft','fabric','fiber','Prepares warp beam.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',1,'Sizing protects','warp yarn','weft','fabric','fiber','Reduces breakage.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',2,'Common sizing agent is','starch','PVA only','wax','silicone','Modified starch.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',3,'Primary loom motions are','shedding picking beating','take-up let-off brake','tension twist draft','carding combing','Three essentials.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',4,'Secondary motions are','take-up and let-off','shedding','picking','beating','Cloth and warp.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',5,'Plain weave repeat','2x2','3x3','4x4','1x4','Smallest repeat.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',6,'Twill shows','diagonal lines','wavy lines','spots','checks','Float pattern.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',7,'Satin surface is','smooth and lustrous','rough','puckered','embossed','Long floats.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',8,'Reed count means','dents per inch','PPI','EPI','yarn count','Warp density.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',9,'EPI stands for','Ends Per Inch','Edges Per Inch','Empty Per Inch','Effects Per Inch','Warp per inch.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',10,'PPI stands for','Picks Per Inch','Plies Per Inch','Ports Per Inch','Pieces Per Inch','Weft per inch.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',11,'Air-jet inserts weft by','compressed air','water','rapier','shuttle','High speed.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',12,'Rapier loom uses','arm to carry weft','air','water','shuttle','Flexible or rigid.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',13,'Projectile loom uses','gripper','air','water','rapier','Sulzer-style.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',14,'Dobby controls','up to 28 healds','needle bed','jet pressure','beam','Small patterns.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',15,'Jacquard controls','each warp end','each weft','take-up','reed','Large motifs.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',16,'Cover factor depends on','yarn count and threads per inch','color','width','temperature','K=N/sqrt(Ne).'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',17,'Crimp is','waviness of yarn in fabric','twist','ply','fade','Crimp percent.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',18,'GSM means','grams per square metre','g per metre','g per yard','g per cm','Areal density.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',19,'Leno produces','open mesh fabric','dense','pile','felt','Doup heald.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',20,'Pile fabrics include','velvet and corduroy','plain','satin','gauze','Cut loops.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',21,'Selvedge is','fabric edge','center stripe','weft float','warp knot','Prevents fray.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',22,'Cam looms suit','simple weaves','jacquard','velvet','leno','Limited healds.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',23,'Let-off motion controls','warp tension','weft speed','reed','beat','Uniform tension.'),
('28c4dffd-2bb6-4453-8254-12154945ebf7',24,'Main loom stop cause','warp breakage','good sizing','correct EPI','humidity','Reduces efficiency.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',0,'Weft knit forms loops','across the width','along length only','diagonally','in zigzag','One yarn per course.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',1,'Warp knit uses','multiple yarns simultaneously','one yarn','no yarn','only weft','Per-needle yarn.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',2,'Latch needle invented by','Matthew Townsend','William Lee','Jedediah Strutt','Eli Whitney','Year 1847.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',3,'Compound needle used in','modern warp knitting','hand knitting','weaving','spinning','Two-part needle.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',4,'CPI means','Courses Per Inch','Cuts Per Inch','Cones Per Inch','Cams Per Inch','Horizontal rows.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',5,'WPI means','Wales Per Inch','Wraps Per Inch','Weft Per Inch','Widths Per Inch','Vertical columns.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',6,'Single jersey made on','single bed circular','double bed','raschel','tricot','Plain knit.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',7,'Interlock made on','double cylinder','single jersey','tricot','raschel','Interlocked rib.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',8,'Rib fabric has','alternating face and back loops','all face','all back','floats','1x1 common.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',9,'Purl fabric has','alternating knit and purl courses','all knit','all rib','all tuck','Same both sides.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',10,'Tricot is','warp knit','weft knit','woven','non-woven','Two guide bars.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',11,'Raschel produces','lace and net','denim','velvet','interlock','Versatile.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',12,'Stitch length affects','weight and stretch','color','count','gauge','Longer lighter.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',13,'Gauge means','needles per inch','yarn count','fabric width','cylinder diameter','Higher finer.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',14,'Tuck stitch','holds old loop with new yarn','drops loop','misses yarn','inverts loop','Adds width.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',15,'Miss stitch','skips new yarn','tucks','clears','transfers','Float behind.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',16,'Spirality due to','yarn twist liveliness','dye','weight','gauge','Z-twist skews.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',17,'Loop length unit is','millimetres','dtex','gauge','inches per pound','Tightness.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',18,'Knit GSM depends on','count gauge and loop length','color','diameter','speed','Structural.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',19,'Pin hole fault from','broken needle','oil stain','yarn knot','slack course','Damaged needle.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',20,'Barre is','horizontal streak','vertical line','hole','stain','Yarn variation.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',21,'Fleece has','brushed back surface','mesh','smooth','leno','Three-thread.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',22,'Pique is','single jersey with tuck','interlock','rib','raschel','Polo shirts.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',23,'Take-down tension affects','loop length and width','color','supply','gauge','Distorts loops.'),
('17f9d89c-c880-4727-af03-d5dcbb3e93a2',24,'Positive feed gives','uniform yarn input','faster only','dyeing','sizing','Equal length.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',0,'Pattern making creates','templates for cutting','seams','dye','ironing','Guides marker.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',1,'Marker efficiency formula','(pattern area / marker area) x 100','width/length','patterns x seam','cuts/hr','Less waste.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',2,'CAM means','Computer Aided Manufacturing','Cut And Match','Cloth Aided Marker','Combined Auto Marker','Auto cutter.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',3,'Lock stitch uses','needle and bobbin thread','two needle threads','chain loop','cover stitch','Class 301.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',4,'Chain stitch class is','100','300','400','500','Class 100.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',5,'Overlock class is','500','100','300','600','Edges fray.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',6,'ISO 4915 defines','stitch types','seams','tolerances','defects','Stitch classes.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',7,'ISO 4916 defines','seam types','stitches','needles','yarn','Seam classes.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',8,'SPI means','Stitches Per Inch','Stitches Per Item','Seams Per Item','Stops Per Inch','Seam strength.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',9,'Denim SPI typical','8 to 10','20 to 25','30 to 35','2 to 4','Lower for strength.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',10,'AQL 2.5 means','acceptable level 2.5 percent','2.5 defects','2.5 inspectors','2.5 minutes','Major defects.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',11,'AQL 4.0 used for','minor defects','critical','weight','color','Looser limit.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',12,'SMV means','Standard Minute Value','Sewing Machine Velocity','Standard Marker Variation','Single Minute Volume','Operation time.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',13,'Line balancing','minimizes bottlenecks','maximizes WIP','reduces SPI','increases width','Equalizes load.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',14,'Line efficiency formula','(earned min / available min) x 100','pieces x SMV','ops x hours','SAM x pieces','Standard formula.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',15,'Bundle system means','pieces tied and moved together','one-piece flow','modular','continuous','Between stations.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',16,'UBT means','Under Bed Trimmer','Upper Bed Tension','Universal Belt Tightener','Upper Bobbin Thread','Trims thread.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',17,'Spreading is','laying fabric in plies','cutting','sewing','ironing','Forms lay.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',18,'Block pattern aka','sloper','template','marker','grader','Base pattern.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',19,'Grading scales','patterns to sizes','colors','seams','buttons','Size set.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',20,'Needle for medium woven','Nm 90','Nm 60','Nm 130','Nm 30','Shirting weight.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',21,'GSM tester uses','round cutter and balance','tape','microscope','loom','100 sq cm disc.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',22,'Fusing bonds','interlining to face fabric','dyes','cuts','sews button','Heat plus pressure.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',23,'Spec sheet contains','measurements and tolerances','price','address','label','Tech pack.'),
('fc8f4df4-01e7-473e-a976-a0a64e431164',24,'Shading in QC means','color variation across rolls','pucker','needle damage','oil stain','Check piece-wise.');

INSERT INTO public.qb_questions (subject_id, question_text, question_type, options, correct_answer, explanation, points, difficulty, is_active)
SELECT
  b.sid,
  CASE d.diff
    WHEN 'basic' THEN ''
    WHEN 'intermediate' THEN '[Applied] '
    WHEN 'advanced' THEN '[Analysis] '
  END || b.q || CASE WHEN pos.v>0 THEN ' (Case '||(pos.v+1)::text||')' ELSE '' END AS question_text,
  'multiple_choice'::qb_question_type,
  CASE (b.seq + pos.v) % 4
    WHEN 0 THEN jsonb_build_array(b.c, b.w1, b.w2, b.w3)
    WHEN 1 THEN jsonb_build_array(b.w1, b.c, b.w2, b.w3)
    WHEN 2 THEN jsonb_build_array(b.w2, b.w3, b.c, b.w1)
    WHEN 3 THEN jsonb_build_array(b.w3, b.w1, b.w2, b.c)
  END AS options,
  b.c,
  b.e,
  CASE d.diff WHEN 'basic' THEN 1 WHEN 'intermediate' THEN 2 WHEN 'advanced' THEN 3 END,
  d.diff::qb_difficulty,
  true
FROM _qb_base b
CROSS JOIN (VALUES ('basic',80),('intermediate',80),('advanced',40)) AS d(diff,total)
CROSS JOIN LATERAL generate_series(0, d.total-1) AS gs(idx)
CROSS JOIN LATERAL (SELECT (gs.idx % 25) AS bidx, (gs.idx / 25) AS v) AS pos
WHERE b.seq = pos.bidx;

DROP TABLE _qb_base;