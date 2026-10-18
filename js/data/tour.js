/* ============================================================
   导览路线
   从午门进、沿中轴走到神武门，最后回望角楼。
   每一站只给建筑名，机位由 views.spotFor() 统一计算，
   避免路线数据与三维坐标各写一套。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  GG.TOUR = {
    title: { zh: '中轴导览', en: 'The Central Axis' },
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
  };
})();
