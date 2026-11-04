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
      }
    ]
  };
})();
