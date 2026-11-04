/* ============================================================
   明清格局对比（纯数据，只做说明，不改几何）
   每条差异都带年代标注与依据说明；依据只写「本场景词条 + 通行沿革」，
   不标未经核对的卷次，避免伪造史料。界面必须显示 disclaimer。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  GG.ERAS = {
    initial: 'qing',
    disclaimer: {
      zh: '示意对比，非史实复原动画。切换只改变说明文字，场景几何不变。',
      en: 'An indicative comparison, not a historical reconstruction animation. Switching eras changes the notes only; the geometry stays the same.'
    },
    intro: {
      zh: '同一座宫城，明清两代的用法与称谓并不一样。选一个朝代，看几处有据可查的变化。',
      en: 'The same palace was used and named differently under the Ming and Qing. Pick a dynasty to read a few documented changes.'
    },
    eras: [
      {
        id: 'ming', label: { zh: '明代', en: 'Ming' }, span: '1420–1644',
        summary: {
          zh: '永乐十八年建成，奉天、华盖、谨身三殿与「御门听政」是这一期的关键词。',
          en: 'Completed in 1420; the Fengtian–Huagai–Jinshen halls and audiences at the gate define this period.'
        }
      },
      {
        id: 'qing', label: { zh: '清代', en: 'Qing' }, span: '1644–1912',
        summary: {
          zh: '沿用明宫而重定称谓、改建内廷，并增建乾隆朝的东路与藏书、礼制建筑。',
          en: 'The Ming plan was kept but renamed and refurbished, with Qianlong-era additions on the east route.'
        }
      }
    ],
    changes: [
      {
        key: 'taihemen',
        era: { zh: '明永乐十八年（1420）建／清顺治二年（1645）改称', en: 'Built 1420 / renamed 1645' },
        ming: {
          zh: '称奉天门，是「御门听政」的场所，皇帝在此处理早朝奏事。',
          en: 'Named Fengtianmen, the gate where the emperor held morning audiences.'
        },
        qing: {
          zh: '改称太和门，仍是外朝三大殿院落的正门，听政重心移至乾清门与养心殿。',
          en: 'Renamed Taihemen; audiences moved to Qianqingmen and Yangxindian.'
        },
        source: {
          zh: '依据：本场景「太和门」词条所载「初名奉天门」与明清宫门改名的通行记载。',
          en: 'Basis: the site’s Taihemen entry (“originally Fengtianmen”) and commonly recorded Ming–Qing gate renamings.'
        }
      },
      {
        key: 'baohedian',
        era: { zh: '明永乐十八年（1420）建／清乾隆朝起为殿试场所', en: 'Built 1420 / palace examinations from the Qianlong reign' },
        ming: {
          zh: '称谨身殿，册立皇后、皇太子时在此更衣。',
          en: 'Named Jinshendian; used as a robing hall for investitures.'
        },
        qing: {
          zh: '改称保和殿，殿试自乾隆朝固定于此，「天子门生」由此而来。',
          en: 'Renamed Baohedian; the palace examination was held here from the Qianlong reign.'
        },
        source: {
          zh: '依据：本场景「保和殿」词条所载明代更衣、清代殿试两种用法。',
          en: 'Basis: the site’s Baohedian entry describing both usages.'
        }
      },
      {
        key: 'kunninggong',
        era: { zh: '明永乐十八年（1420）建／清顺治年间改建', en: 'Built 1420 / remodelled in the Shunzhi reign' },
        ming: {
          zh: '皇后的正宫，是内廷中轴上的寝殿。',
          en: 'The empress’s principal residence on the inner axis.'
        },
        qing: {
          zh: '改建后东暖阁作皇帝大婚洞房，西侧设萨满祭祀神堂，保留满族旧俗。',
          en: 'Rebuilt with a bridal chamber in the east and a shamanic shrine in the west.'
        },
        source: {
          zh: '依据：本场景「坤宁宫」词条所载清代改建与祭祀用途。',
          en: 'Basis: the site’s Kunninggong entry on the Qing remodelling and ritual use.'
        }
      },
      {
        key: 'shenwumen',
        era: { zh: '明永乐十八年（1420）建／清康熙年间避讳改称', en: 'Built 1420 / renamed in the Kangxi reign' },
        ming: {
          zh: '称玄武门，取北方玄武之意。',
          en: 'Named Xuanwumen after the northern deity Xuanwu.'
        },
        qing: {
          zh: '避康熙帝玄烨名讳，改称神武门，今为博物院主要参观出口。',
          en: 'Renamed Shenwumen to avoid the Kangxi emperor’s personal name taboo.'
        },
        source: {
          zh: '依据：本场景「神武门」词条所载避讳改名的通行说法。',
          en: 'Basis: the site’s Shenwumen entry on the naming taboo.'
        }
      },
      {
        key: 'daqingmen',
        era: { zh: '明永乐年间建／清顺治元年（1644）改称', en: 'Built in the Yongle reign / renamed 1644' },
        ming: {
          zh: '称大明门，是皇城最南端的门，门内千步廊直达承天门。',
          en: 'Named Damingmen, the southernmost gate of the Imperial City.'
        },
        qing: {
          zh: '改称大清门，民国初年再改中华门；门内御路格局未变。',
          en: 'Renamed Daqingmen, then Zhonghuamen in the Republic; the processional axis remained.'
        },
        source: {
          zh: '依据：本场景「大清门」词条所载三次更名与千步廊位置。',
          en: 'Basis: the site’s Daqingmen entry on the three successive names.'
        }
      },
      {
        key: 'qiniandian',
        era: { zh: '明永乐十八年（1420）建大祀殿／清乾隆十九年（1754）定型／清光绪二十二年（1896）重建', en: '1420 Dasi Hall / final form 1754 / rebuilt 1896' },
        ming: {
          zh: '初为合祭天地的「大祀殿」，矩形大殿，与今日圆殿形制不同。',
          en: 'Originally the rectangular Dasi Hall for combined sacrifices to Heaven and Earth.'
        },
        qing: {
          zh: '嘉靖分祀后改建为三重檐圆形祈年殿，乾隆朝定型；现存为光绪重建，形制同乾隆。',
          en: 'Rebuilt as the triple-eaved circular hall, fixed in the Qianlong reign; the surviving hall dates to 1896.'
        },
        source: {
          zh: '依据：本场景「祈年殿」词条与 docs/tiantan.md 的乾隆十九年格局说明。',
          en: 'Basis: the site’s Qiniandian entry and docs/tiantan.md on the 1754 layout.'
        }
      },
      {
        key: 'jingshan',
        era: { zh: '明永乐年间堆土成山／清顺治十二年（1655）改称', en: 'Mounded in the Yongle reign / renamed 1655' },
        ming: {
          zh: '称万岁山，俗称煤山，为营建宫城与护城河时堆土而成。',
          en: 'Named Wansuishan (“Longevity Hill”), formed from excavated soil.'
        },
        qing: {
          zh: '改称景山，五峰与万春亭成为全城制高点；崇祯自缢处在其东麓。',
          en: 'Renamed Jingshan; its five peaks became the city’s highest viewpoint.'
        },
        source: {
          zh: '依据：本场景「景山」词条所载名称沿革与五峰格局。',
          en: 'Basis: the site’s Jingshan entry on the renaming and five peaks.'
        }
      },
      {
        key: 'junjichu',
        era: { zh: '清雍正七年（1729）设，明代无此机构', en: 'Founded 1729; no Ming equivalent' },
        ming: {
          zh: '明代无军机处，相应的机务由内阁与司礼监分掌，此处只是乾清门外的值房地带。',
          en: 'No such office existed; the Grand Secretariat and the Directorate of Ceremonial handled paperwork.'
        },
        qing: {
          zh: '雍正设军机处，值房紧邻养心殿，成为中枢机务所在，是清代新增的功能空间。',
          en: 'The Grand Council was established next to Yangxindian as the Qing command centre.'
        },
        source: {
          zh: '依据：本场景「军机处」词条所载雍正七年设立；明代部分为制度背景说明，场景未做增删。',
          en: 'Basis: the site’s Junjichu entry (founded 1729); the Ming note is institutional background only.'
        }
      }
    ]
  };
})();
