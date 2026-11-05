/* ============================================================
   导览路线
   两条线：中轴（前朝—后寝—御花园）与东西六宫（后妃生活线）。
   每一站只给建筑名，机位由 views.spotFor() 统一计算，
   避免路线数据与三维坐标各写一套。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  GG.TOUR = {
    routes: [
      {
        id: 'axis',
        title: { zh: '中轴导览', en: 'The Central Axis' },
        short: { zh: '中轴', en: 'Axis' },
        stops: [
          {
            target: '午门', dwell: 9000,
            zh: '从午门开始。三面围合的城台与五凤楼，是紫禁城的正门。明清两代，颁诏、献俘都在这里举行。',
            en: 'We begin at the Meridian Gate, the southern entrance of the Forbidden City, where imperial edicts were proclaimed and captives presented.'
          },
          {
            target: '太和门', dwell: 8000,
            zh: '穿过午门，眼前是太和门。明代皇帝常在此御门听政，这里也是外朝三大殿院落的门户。',
            en: 'Beyond the Meridian Gate stands the Gate of Supreme Harmony, where Ming emperors handled state affairs and where the Outer Court begins.'
          },
          {
            target: '太和殿', dwell: 11000,
            zh: '太和殿，俗称金銮殿。重檐庑殿，面阔十一间，是现存最大的木结构殿宇；登极、大婚、册立都在此举行。',
            en: 'The Hall of Supreme Harmony, the largest surviving timber hall in China. Enthronements, weddings and investitures took place beneath its double-eaved roof.'
          },
          {
            target: '中和殿', dwell: 8000,
            zh: '中和殿是皇帝大典前的小憩之所。方形攒尖顶，取《礼记》“中也者，天下之大本也”之意。',
            en: 'The square, pyramid-roofed Hall of Central Harmony served as the emperor’s resting place before ceremonies, its name taken from the Book of Rites.'
          },
          {
            target: '保和殿', dwell: 9000,
            zh: '保和殿在明代是册立皇后、太子的更衣处；清代殿试固定于此，“天子门生”由此产生。',
            en: 'In Ming times this hall was a robing room for investitures; in the Qing it hosted the final imperial examination.'
          },
          {
            target: '乾清门', dwell: 8000,
            zh: '乾清门是内廷正门。康熙朝起，御门听政移到这里，国家的日常决策就在门前的广场上完成。',
            en: 'The Gate of Heavenly Purity marks the Inner Court. From the Kangxi reign, morning audiences moved here, making it the routine seat of government.'
          },
          {
            target: '乾清宫', dwell: 10000,
            zh: '乾清宫是后三宫之首。明清十六位皇帝在此居住理政，“正大光明”匾后曾藏秘密立储的密旨。',
            en: 'The Palace of Heavenly Purity, first of the three rear palaces, housed sixteen emperors. The secret succession edict was hidden behind its “Justice and Honor” plaque.'
          },
          {
            target: '交泰殿', dwell: 8000,
            zh: '交泰殿取“天地交泰”之义。清代皇后在此接受朝贺，殿内珍藏二十五方皇帝御宝。',
            en: 'The Hall of Union, named for the harmony of heaven and earth, held the twenty-five imperial seals and received the empress’s congratulations.'
          },
          {
            target: '坤宁宫', dwell: 8000,
            zh: '坤宁宫是明代皇后正宫。清代改建后，东暖阁成为大婚洞房，西侧设萨满祭祀神堂。',
            en: 'The Palace of Earthly Tranquility was the Ming empress’s residence. The Qing rebuilt it with a wedding chamber to the east and a shamanic altar to the west.'
          },
          {
            target: '钦安殿', dwell: 9000,
            zh: '御花园正中是钦安殿，紫禁城中轴线上唯一的道教建筑，供奉玄天上帝。',
            en: 'At the heart of the Imperial Garden stands the Hall of Imperial Peace, the only Taoist building on the central axis, dedicated to the Dark Emperor.'
          },
          {
            target: '神武门', dwell: 8000,
            zh: '神武门是紫禁城北门，明代称玄武门。今天，参观从这里结束。',
            en: 'The Gate of Divine Prowess, the northern gate—called Xuanwu in Ming times—is where visits to the palace end today.'
          },
          {
            target: '角楼', dwell: 9000,
            zh: '最后回望角楼。三重檐十字歇山，九梁十八柱七十二条脊，是官式建筑中最精巧的类型之一。',
            en: 'We end with a corner tower: triple eaves on a cross-gabled plan, nine beams, eighteen columns and seventy-two ridges—among the most intricate of official buildings.'
          }
        ]
      },

      {
        id: 'inner',
        title: { zh: '六宫导览', en: 'The Six Palaces' },
        short: { zh: '六宫', en: 'Palaces' },
        stops: [
          {
            target: '乾清门', dwell: 8000,
            zh: '过了这道门，就从“国”走进“家”。乾清门以北是后寝，皇帝与后妃日常起居都在这一片院落里。',
            en: 'Cross this gate and the state gives way to the household. North of it lie the residential palaces where emperors and consorts lived.'
          },
          {
            target: '景仁宫', dwell: 9000,
            zh: '东六宫第一座。康熙帝出生于此；清代这里多为妃嫔居所，院落格局两进，正殿五间。',
            en: 'The first of the Eastern Six Palaces. The Kangxi Emperor was born here; in the Qing it housed consorts in a standard two-courtyard plan.'
          },
          {
            target: '承乾宫', dwell: 9000,
            zh: '承乾宫在明代为贵妃所居。顺治帝的董鄂妃曾住这里，她的早逝是清初宫廷最著名的一段故事。',
            en: 'In the Ming this was a consort’s residence. The Shunzhi Emperor’s beloved Consort Donggo lived here; her early death became the most famous episode of the early Qing court.'
          },
          {
            target: '延禧宫', dwell: 9000,
            zh: '延禧宫屡遭火灾。宣统元年，这里动工修建一座玻璃环绕的“水晶宫”，未及完工，清亡。',
            en: 'Repeatedly damaged by fire, the palace was rebuilt in 1909 as a glass-walled “Crystal Palace”. The Qing fell before it was finished.'
          },
          {
            target: '永和宫', dwell: 8000,
            zh: '雍正帝的生母德妃曾居此宫。清代后妃的居所并不固定，随位分与皇帝安排迁动。',
            en: 'Consort De, mother of the Yongzheng Emperor, lived here. Qing consorts did not hold fixed residences; they moved with rank and imperial arrangement.'
          },
          {
            target: '景阳宫', dwell: 8000,
            zh: '明代为嫔妃居所，清代改作藏书与御书房之用。同一座院落，功能随朝代更替而变。',
            en: 'A Ming consort’s residence, converted in the Qing into a library and imperial study—one courtyard, two entirely different functions.'
          },
          {
            target: '永寿宫', dwell: 8000,
            zh: '西六宫之一。明清两代均为妃嫔居所，院落形制与东六宫对称，正殿五间、单檐歇山。',
            en: 'One of the Western Six Palaces. A consort’s residence in both dynasties, it mirrors the Eastern Six in plan: five bays under a single hip-and-gable roof.'
          },
          {
            target: '翊坤宫', dwell: 9000,
            zh: '翊坤宫在明代是郑贵妃的居所，清代宜妃也曾住这里。晚清改建后与储秀宫连通。',
            en: 'Home to Consort Zheng in the Ming and Consort Yi in the Qing. Late-Qing rebuilding connected it directly with the Palace of Gathered Elegance.'
          },
          {
            target: '储秀宫', dwell: 10000,
            zh: '慈禧入宫时居此。五十寿辰时重修，与翊坤宫打通，形成西六宫中轴线上一组完整的院落。',
            en: 'The young Cixi lived here. Rebuilt for her fiftieth birthday, it was joined to the neighbouring palace to form a single grand compound.'
          },
          {
            target: '长春宫', dwell: 9000,
            zh: '长春宫的回廊上有一组《红楼梦》题材壁画，绘于晚清，作者与粉本至今仍有讨论。',
            en: 'The cloister of the Palace of Eternal Spring carries a late-Qing mural cycle based on “Dream of the Red Chamber”; both its painter and source remain debated.'
          },
          {
            target: '咸福宫', dwell: 8000,
            zh: '西六宫最北一座。道光帝为皇子时曾居于此，后来这里也用作妃嫔居所。',
            en: 'The northernmost of the Western Six. The Daoguang Emperor lived here as a prince; later it reverted to consorts’ quarters.'
          },
          {
            target: '万春亭', dwell: 9000,
            zh: '从六宫出来，在御花园的万春亭收束。后妃的世界被高墙分成一格一格，只有这片园子是共用的。',
            en: 'We end at the Pavilion of Ten Thousand Springs in the Imperial Garden. The consorts’ world was divided into walled cells; this garden was the one place they shared.'
          }
        ]
      },

      /* v2.5：东路、西路、京师三条线，接住原先没有引导入口的词条。
         字幕只复述 info.js 的正文，不新增史实与尺寸。 */
      {
        id: 'east',
        title: { zh: '东路导览 · 文华与宁寿', en: 'The Eastern Route' },
        short: { zh: '东路', en: 'East' },
        stops: [
          {
            target: '文华殿', dwell: 8000,
            zh: '从三大殿广场折向东，第一站是文华殿。明代为太子讲学之所，清代经筵典礼在此举行。',
            en: 'East of the main court stands the Hall of Literary Glory: a Ming prince’s schoolroom, later the Qing venue for the Classics Colloquium.'
          },
          {
            target: '文渊阁', dwell: 9000,
            zh: '殿后文渊阁，乾隆四十一年为收藏《四库全书》而建。仿宁波天一阁，黑瓦主水以克火。',
            en: 'Behind it, the Wenyuan Pavilion was built in 1776 to house the Complete Library of the Four Treasuries; its black tiles evoke water against fire.'
          },
          {
            target: '奉先殿', dwell: 8000,
            zh: '奉先殿是宫内的皇家祖庙，供奉明清两代帝后神位，四时致祭。',
            en: 'The Hall of Ancestral Worship served as the imperial family shrine, holding the spirit tablets of Ming and Qing emperors.'
          },
          {
            target: '箭亭', dwell: 8000,
            zh: '箭亭四面开门而不设窗墙，便于驰马放箭，是清廷保持骑射传统而设的建筑。',
            en: 'Open on all four sides for riding and archery, the Arrow Pavilion embodies the Qing effort to preserve mounted skills.'
          },
          {
            target: '毓庆宫', dwell: 8000,
            zh: '毓庆宫康熙年间为皇太子所建，后来定为皇子读书、居住之所。',
            en: 'Built for a crown prince under Kangxi, this palace became the schoolroom and residence of imperial sons.'
          },
          {
            target: '南三所', dwell: 8000,
            zh: '南三所因屋顶覆绿琉璃瓦俗称「阿哥所」，三所院落并排，是清代皇子成长起居之处。',
            en: 'Three parallel compounds with green glazed roofs, the Southern Three Lodges housed Qing princes; their colour earned them the name “Age lodges”.'
          },
          {
            target: '皇极殿', dwell: 9000,
            zh: '皇极殿是宁寿宫区正殿，乾隆为退位后的太上皇生活预建，嘉庆元年在此举行千叟宴。',
            en: 'The chief hall of the Ningshou compound, built in advance for the Qianlong Emperor’s retirement; it hosted the Banquet of a Thousand Elders.'
          },
          {
            target: '宁寿宫', dwell: 8000,
            zh: '宁寿宫经乾隆三十七年改建，成为太上皇的起居院落，其后养性殿、乐寿堂依次排列。',
            en: 'Rebuilt in 1772 as a retired emperor’s residence, with the halls behind it arranged in sequence.'
          },
          {
            target: '养性殿', dwell: 8000,
            zh: '养性殿是宁寿宫区生活区正殿，形制仿养心殿而建，陈设按皇帝日常起居布置。',
            en: 'Modelled on the Hall of Mental Cultivation, this was the main living hall of the Ningshou quarter.'
          },
          {
            target: '乐寿堂', dwell: 8000,
            zh: '乐寿堂在清末是慈禧太后驻园时的寝宫，堂前设庭院与花木。',
            en: 'In the late Qing this was Empress Dowager Cixi’s sleeping quarters, fronted by a planted courtyard.'
          },
          {
            target: '畅音阁', dwell: 9000,
            zh: '畅音阁是三层大戏台，台上设天井、地井可作升降布景，是宫内保存最完整的宫廷戏台。',
            en: 'A three-storey court theatre with ceiling and floor openings for flying scenery—the best preserved of its kind in the palace.'
          },
          {
            target: '符望阁', dwell: 9000,
            zh: '最后一站符望阁，乾隆花园的主建筑，位于园中高处，凭栏可望紫禁城内外。',
            en: 'We finish at the Pavilion of Fulfilled Hopes, the high point of the Qianlong Garden, looking out over the palace.'
          }
        ]
      },

      {
        id: 'west',
        title: { zh: '西路导览 · 武英与慈宁', en: 'The Western Route' },
        short: { zh: '西路', en: 'West' },
        stops: [
          {
            target: '武英殿', dwell: 8000,
            zh: '西路从武英殿开始。清代设修书处于此，所刻「殿本」以纸墨精良、校勘严谨著称。',
            en: 'The western route opens at the Hall of Martial Valour, seat of the Qing imperial printing office famed for its “palace editions”.'
          },
          {
            target: '浴德堂', dwell: 8000,
            zh: '殿后浴德堂设穹顶浴室，是紫禁城中罕见的阿拉伯式建筑。',
            en: 'Behind it, a small hall with a domed bath chamber—a rare Arabic-influenced structure in the Forbidden City.'
          },
          {
            target: '南薰殿', dwell: 8000,
            zh: '南薰殿取《诗经》「南风之薰」之意，清代专藏历代帝王后妃画像。',
            en: 'Named from the Book of Songs, this small hall stored the Qing collection of imperial portraits.'
          },
          {
            target: '咸安宫', dwell: 8000,
            zh: '咸安宫明代为太后、太妃居所，清代曾设官学，选八旗子弟入学肄业。',
            en: 'A Ming residence for dowagers, later the site of a Qing school for Banner sons.'
          },
          {
            target: '内务府', dwell: 8000,
            zh: '内务府总管皇室财政与宫禁事务，宫中吃穿用度、营造修缮无不由其经办。',
            en: 'The Imperial Household Department ran the court’s finances, supplies, building works and daily ceremonies.'
          },
          {
            target: '养心殿', dwell: 10000,
            zh: '雍正帝由乾清宫移居养心殿，此后八位皇帝沿袭，这里成为清代中后期实际的寝宫与理政之所。',
            en: 'From the Yongzheng Emperor onward eight rulers lived and governed here, making it the real centre of the late Qing court.'
          },
          {
            target: '慈宁宫', dwell: 9000,
            zh: '慈宁宫是明清两代皇太后的居所，清初孝庄文皇后曾长居于此。',
            en: 'The residence of empress dowagers in both dynasties; the early Qing dowager Xiaozhuang lived here for years.'
          },
          {
            target: '寿康宫', dwell: 8000,
            zh: '寿康宫是乾隆帝为母亲崇庆皇太后所建，前后两进，是清代太后颐养天年的典型院落。',
            en: 'Built by Qianlong for his mother, its two courtyards typify a Qing dowager’s retirement residence.'
          },
          {
            target: '寿安宫', dwell: 8000,
            zh: '寿安宫明代为咸安宫，乾隆为皇太后受贺改建更名，前有戏台，三进院落相连。',
            en: 'Renamed and rebuilt for a dowager’s birthday celebrations, with a stage in front and three linked courts.'
          },
          {
            target: '临溪亭', dwell: 8000,
            zh: '慈宁宫花园中心的临溪亭跨于池上，是太后太妃礼佛之余游赏之所。',
            en: 'A waterside pavilion at the heart of the Cining garden, where dowagers rested after their devotions.'
          },
          {
            target: '英华殿', dwell: 9000,
            zh: '最后一站英华殿，明清太后、太妃礼佛之所，殿前原有两株菩提树。',
            en: 'We end at the Hall of Flowering Glory, a Buddhist chapel for dowagers, once shaded by two bodhi trees.'
          }
        ]
      },

      {
        id: 'outer',
        title: { zh: '京师导览 · 坛庙与城阙', en: 'The Capital Beyond' },
        short: { zh: '京师', en: 'Capital' },
        stops: [
          {
            target: '端门', dwell: 8000,
            zh: '从午门向南，先过端门。城台上建重檐殿宇，是紫禁城正门的第一重。',
            en: 'South of the Meridian Gate, the Upright Gate is the first of the ceremonial gates, its tower close in form to the Meridian Gate.'
          },
          {
            target: '天安门', dwell: 9000,
            zh: '天安门是皇城正门，城台开五门，前有华表、石狮与金水桥。',
            en: 'The main gate of the Imperial City: five openings beneath a double-eaved tower, fronted by columns, lions and the Golden Water Bridges.'
          },
          {
            target: '太庙', dwell: 8000,
            zh: '太庙在御路东侧，是明清皇帝祭祖的宗庙，与社稷坛构成「左祖右社」。',
            en: 'East of the imperial way, the Ancestral Temple pairs with the Altar of Land and Grain to express the “ancestors left, soil right” rite.'
          },
          {
            target: '社稷坛', dwell: 8000,
            zh: '社稷坛与太庙东西对置，坛面按东青、南赤、中黄、西白、北黑五方铺土。',
            en: 'Opposite the Ancestral Temple, its surface is laid with five coloured soils for the five directions.'
          },
          {
            target: '景山', dwell: 9000,
            zh: '景山在神武门正北，明代称万岁山，五峰东西排列，中峰是全城的制高点。',
            en: 'North of the palace, five artificial peaks form the city’s highest point; in Ming times it was called Wansui Hill.'
          },
          {
            target: '寿皇殿', dwell: 8000,
            zh: '寿皇殿在景山东麓，供奉清代帝后御容，是景山建筑群中等级最高者。',
            en: 'On the hill’s eastern slope, this hall held Qing imperial portraits and outranked the rest of the Jingshan complex.'
          },
          {
            target: '北海', dwell: 8000,
            zh: '北海自辽金以来即为御苑，以琼华岛上的白塔为标志。',
            en: 'An imperial garden since the Liao and Jin, marked by the White Dagoba on Qionghua Island.'
          },
          {
            target: '中南海', dwell: 8000,
            zh: '中南海与北海一脉相连，同属皇城西苑。此处为示意复原，非现状。',
            en: 'Joined to Beihai as part of the western imperial gardens; shown here as an indicative reconstruction.'
          },
          {
            target: '天坛', dwell: 10000,
            zh: '转到外城，天坛是明清两代祭天、祈谷之所，坛域北圆南方，象天法地。',
            en: 'In the outer city, the Temple of Heaven served the Ming and Qing sacrifices to Heaven and prayers for harvest; its plan is round north, square south.'
          },
          {
            target: '圜丘', dwell: 9000,
            zh: '圜丘是冬至祭天之所，坛面以天心石为心，铺扇面石九圈，每圈都是九的倍数。',
            en: 'The winter-solstice altar: nine concentric rings of fan-shaped stones, every count a multiple of nine.'
          },
          {
            target: '皇穹宇', dwell: 8000,
            zh: '皇穹宇平日供奉祭天神牌，外围圆墙磨砖对缝，声波沿壁传递，俗称回音壁。',
            en: 'The shrine storing the sacrificial tablets; its finely jointed circular wall carries sound and is known as the Echo Wall.'
          },
          {
            target: '先农坛', dwell: 9000,
            zh: '最后一站先农坛，明清皇帝每年仲春在此亲耕三推，以示重农。',
            en: 'We finish at the Altar of the First Farmer, where emperors ploughed three furrows each spring to honour agriculture.'
          }
        ]
      }
    ]
  };
})();
