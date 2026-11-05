/* ============================================================
   探索清单（纯数据）
   条目只存 info.js 的 key，名字与英文名在运行时从 GG.INFO 取，
   保证清单、侧栏、标签、匾额永远指向同一座建筑。
   判定口径：打开过该词条即算到过，不累积、不计时、不排名。
   ============================================================ */
(function () {
  const GG = (window.GG = window.GG || {});

  GG.QUESTS = {
    intro: {
      zh: '点开一座殿，就算到过。没有计时，也没有排名。',
      en: 'Open a hall and it counts as visited. No timer, no ranking.'
    },
    footnote: {
      zh: '清单只记「看过什么」，不写进分享链接。',
      en: 'The list only remembers what you have seen; it is never shared.'
    },
    groups: [
      {
        id: 'axis',
        title: { zh: '中轴十殿', en: 'Ten Halls on the Axis' },
        short: { zh: '中轴', en: 'Axis' },
        hint: {
          zh: '从午门一路向北，走到神武门。',
          en: 'From the Meridian Gate north to the Gate of Divine Prowess.'
        },
        done: {
          zh: '中轴已走完 · 十座殿宇都到过了',
          en: 'The central axis is complete · all ten halls visited'
        },
        items: [
          'wumen', 'taihemen', 'taihedian', 'zhonghedian', 'baohedian',
          'qianqingmen', 'qianqinggong', 'jiaotaidian', 'kunninggong', 'shenwumen'
        ]
      },
      {
        id: 'sixpalaces',
        title: { zh: '六宫十二院', en: 'Twelve Palaces of the Six Compounds' },
        short: { zh: '六宫', en: 'Six Palaces' },
        hint: {
          zh: '东西各六院，沿着内廷两侧的巷子慢慢看。',
          en: 'Six compounds on each side of the Inner Court.'
        },
        done: {
          zh: '东西六宫已走遍 · 十二院都到过了',
          en: 'All twelve palaces of the Six Compounds visited'
        },
        items: [
          'jingrengong', 'chengqiangong', 'zhongcuigong', 'yanxigong', 'yonghegong', 'jingyanggong',
          'yongshougong', 'yikungong', 'chuxiugong', 'qixianggong', 'changchungong', 'xianfugong'
        ]
      },
      {
        id: 'vignettes',
        title: { zh: '五处点景', en: 'Five Garden Vignettes' },
        short: { zh: '点景', en: 'Vignettes' },
        hint: {
          zh: '御花园的叠石与亭子，还有城墙转角上的角楼。',
          en: 'Rockery and pavilions in the garden, plus a corner tower.'
        },
        done: {
          zh: '五处点景都看过了',
          en: 'All five garden vignettes visited'
        },
        items: ['duixiushan', 'wanchunting', 'qianqiuting', 'qinandian', 'jiaolou']
      },

      /* v2.5：把导览之外的散点按空间分组接住。
         区域词条「御花园」没有实体，不进清单——点开会是空卡。 */
      {
        id: 'wings',
        title: { zh: '两翼与内廷门殿', en: 'Wings & Inner Gates' },
        short: { zh: '两翼', en: 'Wings' },
        hint: {
          zh: '三大殿两翼的崇楼，以及后三宫之间的门户与小殿。',
          en: 'The flanking towers of the three great halls, and the small gates and halls of the Inner Court.'
        },
        done: {
          zh: '两翼与内廷门殿都到过了',
          en: 'All the wings and inner gates visited'
        },
        items: [
          'tirenge', 'hongyige', 'xiehemen', 'xihemen',
          'kunningmen', 'jingyunmen', 'longzongmen', 'zhaorendian', 'hongdedian'
        ]
      },
      {
        id: 'gates',
        title: { zh: '宫门与内城九门', en: 'Palace & City Gates' },
        short: { zh: '城门', en: 'Gates' },
        hint: {
          zh: '从宫城东西门，走到内城九门，看方位与用途各有不同。',
          en: 'From the palace side gates to the nine gates of the Inner City, each with its own direction and use.'
        },
        done: {
          zh: '十一座城门都到过了',
          en: 'All eleven gates visited'
        },
        items: [
          'donghuamen', 'xihuamen',
          'zhengyangmen', 'chongwenmen', 'xuanwumen', 'chaoyangmen', 'fuchengmen',
          'dongzhimen', 'xizhimen', 'andingmen', 'deshengmen'
        ]
      },
      {
        id: 'outliers',
        title: { zh: '散点拾遗', en: 'Outlying Corners' },
        short: { zh: '拾遗', en: 'Corners' },
        hint: {
          zh: '外城偏门、斋宫，还有几处容易错过的院落与书斋。',
          en: 'Outer-city side gates, the fasting palace, and a few easily missed courtyards and studies.'
        },
        done: {
          zh: '散点都看过了',
          en: 'All the outlying corners visited'
        },
        items: [
          'zhaigong', 'yongdingmen', 'dianmen', 'donganmen', 'xianmen',
          'zuoanmen', 'youanmen', 'guangqumen', 'guanganmen',
          'zhuijingdian', 'shangsiyuan', 'juanqinzhai'
        ]
      }
    ]
  };
})();
