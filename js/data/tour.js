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
      }
    ]
  };
})();
