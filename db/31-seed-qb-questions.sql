-- Practice Arena (Brain Test) question bank was seeded with real content
-- (800 generated questions across Yarn/Fabric Manufacturing/Apparel
-- subjects, plus 2 hand-written Spinning questions) by two original
-- Supabase-era migrations, but neither ever actually took effect on
-- this self-hosted DB -- confirmed live: re-running the insert produces
-- 'new row violates row-level security policy for table qb_questions'.
-- Root cause: qb_questions RLS requires qb_is_staff(auth.uid()), which
-- reads our GUC-based auth.uid() -- these migrations were authored for
-- Supabase's real service_role Postgres role and never set the
-- request.jwt.claim.role='service_role' GUC our self-host auth shim
-- needs (same class of bug as db/26's trigger functions). The FK
-- targets (qb_subjects.id) are fine -- those 4 subjects really do use
-- the fixed UUIDs referenced here, confirmed via direct query.
SELECT set_config('request.jwt.claim.role', 'service_role', false);

-- qb_questions' RLS policy (qb_is_staff(auth.uid())) has no
-- auth.role()='service_role' bypass branch at all -- unlike most other
-- tables in this schema, it purely checks real user_roles membership.
-- Elevating the role GUC alone isn't enough; auth.uid() must also resolve
-- to a real admin/super_admin/instructor user for qb_is_staff() to pass.
SELECT set_config('request.jwt.claim.sub', (SELECT user_id::text FROM public.user_roles WHERE role = 'super_admin' LIMIT 1), false);

INSERT INTO public.qb_questions (subject_id, topic_id, difficulty, question_type, question_text, options, correct_answer, explanation, points, source, is_active) VALUES ((SELECT id FROM public.qb_subjects WHERE slug='spinning'),(SELECT id FROM public.qb_topics WHERE slug='spinning-fiber-to-yarn-process'),'basic'::qb_difficulty,'multiple_choice'::qb_question_type,'What is the primary objective of the opening and cleaning process in the blowroom?','[{"key": "A", "text": "To increase fiber length"}, {"key": "B", "text": "To remove trash and contaminants while preserving fiber quality"}, {"key": "C", "text": "To apply lubricants for better spinning"}, {"key": "D", "text": "To twist the fibers into a loose structure"}]'::jsonb,'B','The blowroom focuses on opening compressed cotton bales into smaller tufts and separating impurities like leaf, seed coats, and dust.',1,'ai'::qb_question_source,true),((SELECT id FROM public.qb_subjects WHERE slug='spinning'),(SELECT id FROM public.qb_topics WHERE slug='spinning-fiber-to-yarn-process'),'basic'::qb_difficulty,'multiple_choice'::qb_question_type,'Which machine is famously referred to as the ''Heart of Spinning'' due to its individualization of fibers?','[{"key": "A", "text": "Drawframe"}, {"key": "B", "text": "Roving Frame"}, {"key": "C", "text": "Carding Machine"}, {"key": "D", "text": "Ring Frame"}]'::jsonb,'C','Carding is responsible for fiber-to-fiber separation, removing remaining trash, and forming the first continuous textile structure (sliver).',1,'ai'::qb_question_source,true);

CREATE TEMP TABLE _qb_base (sid uuid, seq int, q text, c text, w1 text, w2 text, w3 text, e text);
INSERT INTO _qb_base VALUES
('11111111-1111-1111-1111-111111111111',0,'Which natural fiber has the highest tensile strength?','Silk','Cotton','Wool','Jute','Silk reaches ~5 g/den.'),
('11111111-1111-1111-1111-111111111111',1,'Ginning removes','seeds from cotton','dirt from wool','gum from silk','husk from jute','Separates fibers from seeds.'),
('11111111-1111-1111-1111-111111111111',2,'English count Ne is','hanks of 840 yd per pound','m per g','kg per km','yd per oz','Ne = 840-yd hanks per lb.'),
('11111111-1111-1111-1111-111111111111',3,'Tex is','grams per 1000 metres','yd per lb','m per g','grains per yd','Direct count g/1000m.'),
('11111111-1111-1111-1111-111111111111',4,'Blowroom mainly','opens and cleans fibers','spins yarn','winds bobbins','dyes fibers','Removes trash.'),
('11111111-1111-1111-1111-111111111111',5,'Carding is the heart of','spinning','weaving','knitting','dyeing','Individualizes fibers.'),
('11111111-1111-1111-1111-111111111111',6,'Combing removes','short fibers','twist','weight','color','Removes noils.'),
('11111111-1111-1111-1111-111111111111',7,'Drafting means','attenuation of sliver','adding twist','cutting','blending color','Reduces density.'),
('11111111-1111-1111-1111-111111111111',8,'Ring frame inserts','twist','color','moisture','sizing','Drafts and twists.'),
('11111111-1111-1111-1111-111111111111',9,'TPI stands for','Twist Per Inch','Tex Per Inch','Tow Per Inch','Tension Per Inch','Twists per inch.'),
('11111111-1111-1111-1111-111111111111',10,'TM controls','yarn strength and hand','color','fiber length','bale weight','TM=TPI/sqrt(Ne).'),
('11111111-1111-1111-1111-111111111111',11,'Open-end is also called','rotor spinning','ring','mule','cap','Rotor-based.'),
('11111111-1111-1111-1111-111111111111',12,'Air-jet spinning uses','compressed air','water','magnets','steam','Air vortex twist.'),
('11111111-1111-1111-1111-111111111111',13,'Neps are','entangled short fibers','dye spots','sizing','long fibers','Fiber knots.'),
('11111111-1111-1111-1111-111111111111',14,'Micronaire measures','fineness of cotton','length','color','strength','Fineness.'),
('11111111-1111-1111-1111-111111111111',15,'Staple length is','average fiber length','yarn length','roving length','bobbin length','Classifies cotton.'),
('11111111-1111-1111-1111-111111111111',16,'Ne 30 yarn means','30 hanks of 840 yd per lb','30 g/km','30 m/g','30 yd/oz','Higher Ne finer.'),
('11111111-1111-1111-1111-111111111111',17,'Roving is made on','speed frame','ring frame','draw frame','comber','Simplex.'),
('11111111-1111-1111-1111-111111111111',18,'Autoleveller ensures','uniform sliver','twist','dyeing','cutting','Corrects mass.'),
('11111111-1111-1111-1111-111111111111',19,'Nm 50 equals','50 m per gram','50 hanks/lb','50 g/km','50 tex','Metric count.'),
('11111111-1111-1111-1111-111111111111',20,'Denier equals','grams per 9000 m','g per 100m','g/km','kg/km','Filament count.'),
('11111111-1111-1111-1111-111111111111',21,'Mule spins','woollen yarn','silk','jute','cotton','Soft lofty.'),
('11111111-1111-1111-1111-111111111111',22,'CV percent indicates','evenness','color','ply','twist','Lower better.'),
('11111111-1111-1111-1111-111111111111',23,'Hairiness measured by','Uster','GSM tester','Pilling tester','Bursting tester','H value.'),
('11111111-1111-1111-1111-111111111111',24,'Compact spinning improves','strength and reduces hairiness','absorbency','bulk','fastness','Suction zone.'),
('22222222-2222-2222-2222-222222222222',0,'Warping winds','parallel yarns on a beam','weft','fabric','fiber','Prepares warp beam.'),
('22222222-2222-2222-2222-222222222222',1,'Sizing protects','warp yarn','weft','fabric','fiber','Reduces breakage.'),
('22222222-2222-2222-2222-222222222222',2,'Common sizing agent is','starch','PVA only','wax','silicone','Modified starch.'),
('22222222-2222-2222-2222-222222222222',3,'Primary loom motions are','shedding picking beating','take-up let-off brake','tension twist draft','carding combing','Three essentials.'),
('22222222-2222-2222-2222-222222222222',4,'Secondary motions are','take-up and let-off','shedding','picking','beating','Cloth and warp.'),
('22222222-2222-2222-2222-222222222222',5,'Plain weave repeat','2x2','3x3','4x4','1x4','Smallest repeat.'),
('22222222-2222-2222-2222-222222222222',6,'Twill shows','diagonal lines','wavy lines','spots','checks','Float pattern.'),
('22222222-2222-2222-2222-222222222222',7,'Satin surface is','smooth and lustrous','rough','puckered','embossed','Long floats.'),
('22222222-2222-2222-2222-222222222222',8,'Reed count means','dents per inch','PPI','EPI','yarn count','Warp density.'),
('22222222-2222-2222-2222-222222222222',9,'EPI stands for','Ends Per Inch','Edges Per Inch','Empty Per Inch','Effects Per Inch','Warp per inch.'),
('22222222-2222-2222-2222-222222222222',10,'PPI stands for','Picks Per Inch','Plies Per Inch','Ports Per Inch','Pieces Per Inch','Weft per inch.'),
('22222222-2222-2222-2222-222222222222',11,'Air-jet inserts weft by','compressed air','water','rapier','shuttle','High speed.'),
('22222222-2222-2222-2222-222222222222',12,'Rapier loom uses','arm to carry weft','air','water','shuttle','Flexible or rigid.'),
('22222222-2222-2222-2222-222222222222',13,'Projectile loom uses','gripper','air','water','rapier','Sulzer-style.'),
('22222222-2222-2222-2222-222222222222',14,'Dobby controls','up to 28 healds','needle bed','jet pressure','beam','Small patterns.'),
('22222222-2222-2222-2222-222222222222',15,'Jacquard controls','each warp end','each weft','take-up','reed','Large motifs.'),
('22222222-2222-2222-2222-222222222222',16,'Cover factor depends on','yarn count and threads per inch','color','width','temperature','K=N/sqrt(Ne).'),
('22222222-2222-2222-2222-222222222222',17,'Crimp is','waviness of yarn in fabric','twist','ply','fade','Crimp percent.'),
('22222222-2222-2222-2222-222222222222',18,'GSM means','grams per square metre','g per metre','g per yard','g per cm','Areal density.'),
('22222222-2222-2222-2222-222222222222',19,'Leno produces','open mesh fabric','dense','pile','felt','Doup heald.'),
('22222222-2222-2222-2222-222222222222',20,'Pile fabrics include','velvet and corduroy','plain','satin','gauze','Cut loops.'),
('22222222-2222-2222-2222-222222222222',21,'Selvedge is','fabric edge','center stripe','weft float','warp knot','Prevents fray.'),
('22222222-2222-2222-2222-222222222222',22,'Cam looms suit','simple weaves','jacquard','velvet','leno','Limited healds.'),
('22222222-2222-2222-2222-222222222222',23,'Let-off motion controls','warp tension','weft speed','reed','beat','Uniform tension.'),
('22222222-2222-2222-2222-222222222222',24,'Main loom stop cause','warp breakage','good sizing','correct EPI','humidity','Reduces efficiency.'),
('22222222-2222-2222-2222-222222222222',0,'Weft knit forms loops','across the width','along length only','diagonally','in zigzag','One yarn per course.'),
('22222222-2222-2222-2222-222222222222',1,'Warp knit uses','multiple yarns simultaneously','one yarn','no yarn','only weft','Per-needle yarn.'),
('22222222-2222-2222-2222-222222222222',2,'Latch needle invented by','Matthew Townsend','William Lee','Jedediah Strutt','Eli Whitney','Year 1847.'),
('22222222-2222-2222-2222-222222222222',3,'Compound needle used in','modern warp knitting','hand knitting','weaving','spinning','Two-part needle.'),
('22222222-2222-2222-2222-222222222222',4,'CPI means','Courses Per Inch','Cuts Per Inch','Cones Per Inch','Cams Per Inch','Horizontal rows.'),
('22222222-2222-2222-2222-222222222222',5,'WPI means','Wales Per Inch','Wraps Per Inch','Weft Per Inch','Widths Per Inch','Vertical columns.'),
('22222222-2222-2222-2222-222222222222',6,'Single jersey made on','single bed circular','double bed','raschel','tricot','Plain knit.'),
('22222222-2222-2222-2222-222222222222',7,'Interlock made on','double cylinder','single jersey','tricot','raschel','Interlocked rib.'),
('22222222-2222-2222-2222-222222222222',8,'Rib fabric has','alternating face and back loops','all face','all back','floats','1x1 common.'),
('22222222-2222-2222-2222-222222222222',9,'Purl fabric has','alternating knit and purl courses','all knit','all rib','all tuck','Same both sides.'),
('22222222-2222-2222-2222-222222222222',10,'Tricot is','warp knit','weft knit','woven','non-woven','Two guide bars.'),
('22222222-2222-2222-2222-222222222222',11,'Raschel produces','lace and net','denim','velvet','interlock','Versatile.'),
('22222222-2222-2222-2222-222222222222',12,'Stitch length affects','weight and stretch','color','count','gauge','Longer lighter.'),
('22222222-2222-2222-2222-222222222222',13,'Gauge means','needles per inch','yarn count','fabric width','cylinder diameter','Higher finer.'),
('22222222-2222-2222-2222-222222222222',14,'Tuck stitch','holds old loop with new yarn','drops loop','misses yarn','inverts loop','Adds width.'),
('22222222-2222-2222-2222-222222222222',15,'Miss stitch','skips new yarn','tucks','clears','transfers','Float behind.'),
('22222222-2222-2222-2222-222222222222',16,'Spirality due to','yarn twist liveliness','dye','weight','gauge','Z-twist skews.'),
('22222222-2222-2222-2222-222222222222',17,'Loop length unit is','millimetres','dtex','gauge','inches per pound','Tightness.'),
('22222222-2222-2222-2222-222222222222',18,'Knit GSM depends on','count gauge and loop length','color','diameter','speed','Structural.'),
('22222222-2222-2222-2222-222222222222',19,'Pin hole fault from','broken needle','oil stain','yarn knot','slack course','Damaged needle.'),
('22222222-2222-2222-2222-222222222222',20,'Barre is','horizontal streak','vertical line','hole','stain','Yarn variation.'),
('22222222-2222-2222-2222-222222222222',21,'Fleece has','brushed back surface','mesh','smooth','leno','Three-thread.'),
('22222222-2222-2222-2222-222222222222',22,'Pique is','single jersey with tuck','interlock','rib','raschel','Polo shirts.'),
('22222222-2222-2222-2222-222222222222',23,'Take-down tension affects','loop length and width','color','supply','gauge','Distorts loops.'),
('22222222-2222-2222-2222-222222222222',24,'Positive feed gives','uniform yarn input','faster only','dyeing','sizing','Equal length.'),
('44444444-4444-4444-4444-444444444444',0,'Pattern making creates','templates for cutting','seams','dye','ironing','Guides marker.'),
('44444444-4444-4444-4444-444444444444',1,'Marker efficiency formula','(pattern area / marker area) x 100','width/length','patterns x seam','cuts/hr','Less waste.'),
('44444444-4444-4444-4444-444444444444',2,'CAM means','Computer Aided Manufacturing','Cut And Match','Cloth Aided Marker','Combined Auto Marker','Auto cutter.'),
('44444444-4444-4444-4444-444444444444',3,'Lock stitch uses','needle and bobbin thread','two needle threads','chain loop','cover stitch','Class 301.'),
('44444444-4444-4444-4444-444444444444',4,'Chain stitch class is','100','300','400','500','Class 100.'),
('44444444-4444-4444-4444-444444444444',5,'Overlock class is','500','100','300','600','Edges fray.'),
('44444444-4444-4444-4444-444444444444',6,'ISO 4915 defines','stitch types','seams','tolerances','defects','Stitch classes.'),
('44444444-4444-4444-4444-444444444444',7,'ISO 4916 defines','seam types','stitches','needles','yarn','Seam classes.'),
('44444444-4444-4444-4444-444444444444',8,'SPI means','Stitches Per Inch','Stitches Per Item','Seams Per Item','Stops Per Inch','Seam strength.'),
('44444444-4444-4444-4444-444444444444',9,'Denim SPI typical','8 to 10','20 to 25','30 to 35','2 to 4','Lower for strength.'),
('44444444-4444-4444-4444-444444444444',10,'AQL 2.5 means','acceptable level 2.5 percent','2.5 defects','2.5 inspectors','2.5 minutes','Major defects.'),
('44444444-4444-4444-4444-444444444444',11,'AQL 4.0 used for','minor defects','critical','weight','color','Looser limit.'),
('44444444-4444-4444-4444-444444444444',12,'SMV means','Standard Minute Value','Sewing Machine Velocity','Standard Marker Variation','Single Minute Volume','Operation time.'),
('44444444-4444-4444-4444-444444444444',13,'Line balancing','minimizes bottlenecks','maximizes WIP','reduces SPI','increases width','Equalizes load.'),
('44444444-4444-4444-4444-444444444444',14,'Line efficiency formula','(earned min / available min) x 100','pieces x SMV','ops x hours','SAM x pieces','Standard formula.'),
('44444444-4444-4444-4444-444444444444',15,'Bundle system means','pieces tied and moved together','one-piece flow','modular','continuous','Between stations.'),
('44444444-4444-4444-4444-444444444444',16,'UBT means','Under Bed Trimmer','Upper Bed Tension','Universal Belt Tightener','Upper Bobbin Thread','Trims thread.'),
('44444444-4444-4444-4444-444444444444',17,'Spreading is','laying fabric in plies','cutting','sewing','ironing','Forms lay.'),
('44444444-4444-4444-4444-444444444444',18,'Block pattern aka','sloper','template','marker','grader','Base pattern.'),
('44444444-4444-4444-4444-444444444444',19,'Grading scales','patterns to sizes','colors','seams','buttons','Size set.'),
('44444444-4444-4444-4444-444444444444',20,'Needle for medium woven','Nm 90','Nm 60','Nm 130','Nm 30','Shirting weight.'),
('44444444-4444-4444-4444-444444444444',21,'GSM tester uses','round cutter and balance','tape','microscope','loom','100 sq cm disc.'),
('44444444-4444-4444-4444-444444444444',22,'Fusing bonds','interlining to face fabric','dyes','cuts','sews button','Heat plus pressure.'),
('44444444-4444-4444-4444-444444444444',23,'Spec sheet contains','measurements and tolerances','price','address','label','Tech pack.'),
('44444444-4444-4444-4444-444444444444',24,'Shading in QC means','color variation across rolls','pucker','needle damage','oil stain','Check piece-wise.');

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