// Seed products — mirrors the original static js/data/products.js catalog (6 items).
module.exports = [
  {
    id: "mc-prod-01",
    category: "electronics",
    image: "assets/images/hero_headphones_1786868115805.jpg",
    model3dType: "headphones",
    isFeatured: true,
    isFactoryDirect: true,
    rating: 4.9,
    reviewsCount: 384,
    priceBDT: 5450, priceUSD: 44.5, priceCNY: 320,
    moq: 10,
    originCity: "Shenzhen, Guangdong",
    shippingMethods: ["air", "sea"],
    leadTimeAir: "7-10 Days",
    leadTimeSea: "40-50 Days",
    wholesaleTiers: [
      { min: 10, max: 49, priceBDT: 5450, priceUSD: 44.5, priceCNY: 320, discount: "0%" },
      { min: 50, max: 199, priceBDT: 4850, priceUSD: 39.5, priceCNY: 285, discount: "11%" },
      { min: 200, max: 9999, priceBDT: 4200, priceUSD: 34.0, priceCNY: 245, discount: "23%" }
    ],
    name: {
      bn: "হাই-রেজ অ্যাক্টিভ নয়েজ ক্যানসেলিং হেডফোন (ম্যাট ব্ল্যাক)",
      en: "Hi-Res Active Noise Cancelling Studio Headphones",
      zh: "高解析度主动降噪旗舰头戴式耳机 (曜石黑)"
    },
    tagline: {
      bn: "শেনঝেন প্রিমিয়াম অডিও ল্যাব থেকে সরাসরি সোর্সিং",
      en: "Direct sourcing from Shenzhen premier audio manufacturing lab",
      zh: "深圳顶尖声学实验室直发 · 45dB 深度混合降噪"
    },
    description: {
      bn: "৪০মিমি নিওডিমিয়াম ড্রাইভার, ৪৫ডিবি হাইব্রিড এএনসি এবং ৫০ ঘণ্টার ব্যাটারি লাইফ সহ চীনের শেনঝেন ফ্যাক্টরি থেকে সরাসরি আমদানিকৃত প্রিমিয়াম স্টুডিও হেডফোন।",
      en: "Premium wireless headphones engineered with 40mm titanium diaphragm drivers, 45dB hybrid ANC, and 50-hour ultra battery endurance directly from Shenzhen audio factories.",
      zh: "采用 40mm 镀钛振膜动圈单元，45dB 混合式深度降噪，50小时超长续航，专为高品质音频发烧友与外贸批发打造。"
    },
    specs: {
      bn: [
        { label: "ব্লুটুথ ভার্সন", value: "৫.৩ লো-লেটেন্সি" },
        { label: "ব্যাটারি ব্যাকআপ", value: "৫০ ঘণ্টা প্লেব্যাক" },
        { label: "নয়েজ রিডাকশন", value: "৪৫ dB হাইব্রিড ANC" },
        { label: "চার্জিং পোর্ট", value: "USB Type-C ফাস্ট চার্জ" },
        { label: "ওজন", value: "২৫৫ গ্রাম" }
      ],
      en: [
        { label: "Bluetooth Version", value: "v5.3 Low Latency" },
        { label: "Battery Life", value: "50 Hours Playback" },
        { label: "Noise Cancellation", value: "45dB Hybrid ANC" },
        { label: "Charging Port", value: "USB-C Fast Charging" },
        { label: "Net Weight", value: "255g" }
      ],
      zh: [
        { label: "蓝牙规格", value: "v5.3 超低延迟" },
        { label: "续航时间", value: "50 小时连续播放" },
        { label: "降噪深度", value: "45dB 混合双馈降噪" },
        { label: "充电接口", value: "Type-C 极速快充" },
        { label: "整机重量", value: "255克" }
      ]
    }
  },
  {
    id: "mc-prod-02",
    category: "lifestyle",
    image: "assets/images/smart_watch_1786868187774.jpg",
    model3dType: "watch",
    isFeatured: true,
    isFactoryDirect: true,
    rating: 4.8,
    reviewsCount: 512,
    priceBDT: 3850, priceUSD: 31.4, priceCNY: 226,
    moq: 20,
    originCity: "Dongguan, Guangdong",
    shippingMethods: ["air", "sea"],
    leadTimeAir: "7-10 Days",
    leadTimeSea: "40-50 Days",
    wholesaleTiers: [
      { min: 20, max: 99, priceBDT: 3850, priceUSD: 31.4, priceCNY: 226, discount: "0%" },
      { min: 100, max: 499, priceBDT: 3350, priceUSD: 27.3, priceCNY: 196, discount: "13%" },
      { min: 500, max: 9999, priceBDT: 2850, priceUSD: 23.2, priceCNY: 167, discount: "26%" }
    ],
    name: {
      bn: "টাইটানিয়াম ফ্রেম ১.৯৬ ইঞ্চি অ্যামোলেড স্মার্টওয়াচ আল্ট্রা",
      en: "Titanium Alloy 1.96-inch AMOLED Rugged Smartwatch Ultra",
      zh: "钛合金外框 1.96寸 AMOLED 户外硬核智能手表"
    },
    tagline: {
      bn: "ডংগুয়ান অরিজিনাল ফ্যাক্টরি প্রস্তুতকারক",
      en: "Dongguan certified high-precision wearable line",
      zh: "东莞精密智能穿戴产业带直供 · IP68 深度防水"
    },
    description: {
      bn: "১.৯৬ ইঞ্চি এইচডি অ্যামোলেড ডিসপ্লে, রিয়েলটাইম হার্ট রেট ও SpO2 সেন্সর, ব্লুটুথ কলিং এবং IP68 ওয়াটারপ্রুফ রেটিং সহ প্রিমিয়াম মিলিটারি গ্রেড স্মার্টওয়াচ।",
      en: "Military-grade aerospace titanium casing smartwatch featuring a 1.96-inch curved AMOLED display, Bluetooth crystal calling, optical biosensors, and IP68 waterproof rating.",
      zh: "航空级钛合金机身，1.96寸高清全天候常亮 AMOLED 屏，高清双向通话与精准生物体征监测，跨境热销爆款。"
    },
    specs: {
      bn: [
        { label: "ডিসপ্লে", value: "১.৯৬\" AMOLED (৪১০x৫০২ px)" },
        { label: "ওয়াটার রেটিং", value: "IP68 ওয়াটারপ্রুফ" },
        { label: "ব্যাটারি", value: "৪২০ mAh (১৫ দিন স্ট্যান্ডবাই)" },
        { label: "সেন্সর", value: "হৃদস্পন্দন, SpO2, স্লিপ ট্র্যাকার" }
      ],
      en: [
        { label: "Display", value: "1.96\" AMOLED (410x502 px)" },
        { label: "Water Resistance", value: "IP68 Certified" },
        { label: "Battery", value: "420mAh (15 Days Standby)" },
        { label: "Sensors", value: "Heart Rate, SpO2, Sleep Monitor" }
      ],
      zh: [
        { label: "屏幕尺寸", value: "1.96寸 AMOLED (410x502分辨率)" },
        { label: "防水等级", value: "IP68 级防尘防水" },
        { label: "电池容量", value: "420mAh (15天超长待机)" },
        { label: "传感器", value: "动态心率 / 血氧 / 睡眠监测" }
      ]
    }
  },
  {
    id: "mc-prod-03",
    category: "electronics",
    image: "assets/images/smart_keyboard_1786868136031.jpg",
    model3dType: "keyboard",
    isFeatured: true,
    isFactoryDirect: true,
    rating: 4.9,
    reviewsCount: 220,
    priceBDT: 4600, priceUSD: 37.5, priceCNY: 270,
    moq: 15,
    originCity: "Huizhou, Guangdong",
    shippingMethods: ["air", "sea"],
    leadTimeAir: "7-10 Days",
    leadTimeSea: "40-50 Days",
    wholesaleTiers: [
      { min: 15, max: 49, priceBDT: 4600, priceUSD: 37.5, priceCNY: 270, discount: "0%" },
      { min: 50, max: 199, priceBDT: 3990, priceUSD: 32.5, priceCNY: 234, discount: "13%" },
      { min: 200, max: 9999, priceBDT: 3450, priceUSD: 28.1, priceCNY: 202, discount: "25%" }
    ],
    name: {
      bn: "কাস্টম গ্যাসকেট ট্রাই-মোড মেকানিক্যাল কিবোর্ড (OLED স্ক্রিন)",
      en: "Custom Gasket Tri-Mode Mechanical Keyboard with OLED Screen",
      zh: "客制化 Gasket 结构三模机械键盘 (带OLED彩屏)"
    },
    tagline: {
      bn: "হুইঝো মেকানিক্যাল কিবোর্ড স্পেশালিস্ট কারখানা",
      en: "Huizhou high-end custom mechanical switch factory",
      zh: "惠州客制化键盘源头工厂 · 全键热插拔"
    },
    description: {
      bn: "হট-সোয়াপ্যাবল সুইচ, গ্যাসকেট মাউন্ট কাঠামো, আরজিবি ব্যাকলাইট এবং কাস্টম জিআইএফ ও স্ট্যাটাস প্রদর্শনের জন্য ইন্টিগ্রেটেড ওএলইডি স্মার্ট ডিসপ্লে।",
      en: "Pro-grade mechanical keyboard with hot-swappable yellow switches, 5-layer acoustic dampening gasket structure, dynamic RGB, and interactive OLED mini display.",
      zh: "采用五层消音填充 Gasket 结构，全键热插拔，三模无线连接，顶角配备多功能 OLED 自定义动图彩屏。"
    },
    specs: {
      bn: [
        { label: "লেআউট", value: "৭৫% কমপ্যাক্ট (৮১ কি)" },
        { label: "কানেক্টিভিটি", value: "2.4G / Bluetooth 5.0 / Type-C" },
        { label: "সুইচ", value: "প্রি-লুবড লিনিয়ার সুইচেস" },
        { label: "ব্যাটারি", value: "৪০০০ mAh রিচার্জেবল" }
      ],
      en: [
        { label: "Layout", value: "75% Compact (81 Keys)" },
        { label: "Connectivity", value: "2.4GHz / BT 5.0 / Wired USB-C" },
        { label: "Switches", value: "Factory Pre-Lubed Linear" },
        { label: "Battery", value: "4000mAh Lithium Rechargeable" }
      ],
      zh: [
        { label: "配列布局", value: "75% 精简配列 (81键)" },
        { label: "连接模式", value: "2.4G无线 / 蓝牙5.0 / 有线Type-C" },
        { label: "轴体类型", value: "出厂精润定制线性轴" },
        { label: "内置电池", value: "4000mAh 大容量锂电" }
      ]
    }
  },
  {
    id: "mc-prod-04",
    category: "home",
    image: "assets/images/ambient_lamp_1786868262403.jpg",
    model3dType: "lamp",
    isFeatured: true,
    isFactoryDirect: true,
    rating: 4.8,
    reviewsCount: 168,
    priceBDT: 3200, priceUSD: 26.1, priceCNY: 188,
    moq: 20,
    originCity: "Zhongshan, Guangdong",
    shippingMethods: ["air", "sea"],
    leadTimeAir: "7-10 Days",
    leadTimeSea: "40-50 Days",
    wholesaleTiers: [
      { min: 20, max: 99, priceBDT: 3200, priceUSD: 26.1, priceCNY: 188, discount: "0%" },
      { min: 100, max: 299, priceBDT: 2750, priceUSD: 22.4, priceCNY: 161, discount: "14%" },
      { min: 300, max: 9999, priceBDT: 2300, priceUSD: 18.7, priceCNY: 135, discount: "28%" }
    ],
    name: {
      bn: "ম্যাগনেটিক লেভিটেশন অ্যাম্বিয়েন্ট স্মার্ট মুন ল্যাম্প",
      en: "Magnetic Levitation Ambient Smart Moon Lamp & Charger",
      zh: "磁悬浮智能无线充氛围月球灯"
    },
    tagline: {
      bn: "ঝংশান গ্লোবাল লাইটিং ক্যাপিটাল সরাসরি উৎপাদন",
      en: "Zhongshan world lighting capital direct manufacturing",
      zh: "中国灯都中山源头直采 · 悬浮无线供电"
    },
    description: {
      bn: "ম্যাগনেটিক ফ্লোটিং টেকনোলজি, ১৬ মিলিয়ন আরজিবি কালার কন্ট্রোল এবং বেসে ১৫ ওয়াট ওয়্যারলেস ফাস্ট চার্জার সহ আধুনিক বিলাসবহুল হোম ডেকর ল্যাম্প।",
      en: "Futuristic 3D printed lunar globe floating freely in mid-air via magnetic levitation with 15W Qi fast wireless charging base and ambient touch dimming.",
      zh: "利用电磁悬浮技术实现月球本体空中静止自转，底座集成 15W 极速无线充电板，支持触控调色与呼吸氛围感。"
    },
    specs: {
      bn: [
        { label: "প্রযুক্তি", value: "ম্যাগনেটিক লেভিটেশন" },
        { label: "ওয়্যারলেস চার্জিং", value: "১৫W Qi ফাস্ট চার্জিং" },
        { label: "রঙের মোড", value: "১৬ মিলিয়ন RGB ও ওয়ার্ম লাইট" },
        { label: "পাওয়ার সাপ্লাই", value: "12V 2A অ্যাডাপ্টার" }
      ],
      en: [
        { label: "Technology", value: "Magnetic Suspension Levitation" },
        { label: "Wireless Output", value: "15W Qi Fast Charge" },
        { label: "Color Spectrum", value: "16M RGB + Warm Dual Glow" },
        { label: "Power Input", value: "12V 2A Adapter" }
      ],
      zh: [
        { label: "核心技术", value: "高精度电磁悬浮系统" },
        { label: "无线充功率", value: "15W Qi 协议极速快充" },
        { label: "灯光模式", value: "1600万色 RGB + 无极调光" },
        { label: "电源规格", value: "12V 2A 稳压适配器" }
      ]
    }
  },
  {
    id: "mc-prod-05",
    category: "electronics",
    image: "assets/images/spatial_earbuds_1786868440170.jpg",
    model3dType: "earbuds",
    isFeatured: true,
    isFactoryDirect: true,
    rating: 4.9,
    reviewsCount: 440,
    priceBDT: 2450, priceUSD: 20.0, priceCNY: 144,
    moq: 25,
    originCity: "Shenzhen, Guangdong",
    shippingMethods: ["air", "sea"],
    leadTimeAir: "7-10 Days",
    leadTimeSea: "40-50 Days",
    wholesaleTiers: [
      { min: 25, max: 99, priceBDT: 2450, priceUSD: 20.0, priceCNY: 144, discount: "0%" },
      { min: 100, max: 499, priceBDT: 2050, priceUSD: 16.7, priceCNY: 120, discount: "16%" },
      { min: 500, max: 9999, priceBDT: 1750, priceUSD: 14.2, priceCNY: 102, discount: "29%" }
    ],
    name: {
      bn: "ট্রান্সপারেন্ট সাইবার স্প্যাশিয়াল অডিও ইয়ারবাডস",
      en: "Transparent Cyber Spatial Audio TWS Earbuds",
      zh: "透明机甲空间音频 TWS 降噪无线蓝牙耳机"
    },
    tagline: {
      bn: "ট্রেন্ডিং হাই-ডিমান্ড গেমিং ও মিউজিক ইয়ারবাডস",
      en: "High-volume trending consumer audio line",
      zh: "赛博透明机舱设计 · 360° 空间环绕立体声"
    },
    description: {
      bn: "স্বচ্ছ মেটাল ফ্রেম কেস, ৪ মাইক্রোফোন ENC ক্লিয়ার কলিং, ৩৬০ ডিগ্রি স্প্যাশিয়াল অডিও এবং ৪০ms আল্ট্রা-লো গেমিং লেটেন্সি সহ আধুনিক ইয়ারবাডস।",
      en: "Futuristic transparent aesthetic earbuds packed with quad-mic ENC for crystal-clear calls, 360° spatial cinema sound, and 40ms low gaming latency.",
      zh: "前卫透明太空舱工业设计，四麦环境降噪高清通话，支持空间音频头部追踪与 40ms 游戏超低延迟。"
    },
    specs: {
      bn: [
        { label: "ড্রাইভার", value: "১৩ মিমি গ্রাফিন ড্রাইভার" },
        { label: "লেটেন্সি", value: "৪০ms গেমিং মোড" },
        { label: "প্লেটাইম", value: "৩২ ঘণ্টা (কেস সহ)" },
        { label: "মাইক্রোফোন", value: "৪-Mic ENC নয়েজ ক্যানসেলিং" }
      ],
      en: [
        { label: "Driver Unit", value: "13mm Graphene Composite" },
        { label: "Latency", value: "40ms Low-Latency Gaming" },
        { label: "Playback", value: "32 Hours with Case" },
        { label: "Mic", value: "Quad-Mic Environmental NC" }
      ],
      zh: [
        { label: "发声单元", value: "13mm 石墨烯复合大动圈" },
        { label: "延迟水平", value: "40ms 竞技级无感延迟" },
        { label: "综合续航", value: "32 小时 (配合充电舱)" },
        { label: "麦克风", value: "四麦 ENC 智能通话降噪" }
      ]
    }
  },
  {
    id: "mc-prod-06",
    category: "machinery",
    image: "assets/images/carbon_mouse_1786868314601.jpg",
    model3dType: "mouse",
    isFeatured: true,
    isFactoryDirect: true,
    rating: 4.8,
    reviewsCount: 195,
    priceBDT: 3100, priceUSD: 25.3, priceCNY: 182,
    moq: 20,
    originCity: "Yiwu, Zhejiang",
    shippingMethods: ["air", "sea"],
    leadTimeAir: "7-10 Days",
    leadTimeSea: "40-50 Days",
    wholesaleTiers: [
      { min: 20, max: 99, priceBDT: 3100, priceUSD: 25.3, priceCNY: 182, discount: "0%" },
      { min: 100, max: 399, priceBDT: 2650, priceUSD: 21.6, priceCNY: 155, discount: "15%" },
      { min: 400, max: 9999, priceBDT: 2250, priceUSD: 18.3, priceCNY: 132, discount: "27%" }
    ],
    name: {
      bn: "কার্বন ফাইবার ম্যাগনেসিয়াম আল্ট্রালাইট ওয়্যারলেস গেমিং মাউস",
      en: "Carbon Fiber Magnesium Alloy Ultralight 4K Wireless Mouse",
      zh: "碳纤维镁合金 4K 轮询超轻量无线电竞鼠标"
    },
    tagline: {
      bn: "প্রফেশনাল এক্সপোর্ট কোয়ালিটি গেমিং পেরিফেরালস",
      en: "Export grade pro esports peripheral line",
      zh: "原相 PAW3395 顶级传感器 · 仅重 49g"
    },
    description: {
      bn: "মাত্র ৪৯ গ্রাম ওজনের কার্বন ফাইবার ফ্রেম, PAW3395 ফ্ল্যাগশিপ সেন্সর (২৬,০০০ ডিপিআই) এবং ৪০০০Hz পোলিং রেট সহ বিশ্বমানের গেমিং মাউস।",
      en: "Featherweight 49-gram magnesium skeleton design powered by the flagship PAW3395 optical sensor with 26,000 DPI and true 4000Hz polling rate.",
      zh: "采用超轻量化镁合金与碳纤维镂空机身，搭载原相 PAW3395 旗舰传感器，支持 4000Hz 真实高回报率。"
    },
    specs: {
      bn: [
        { label: "ওজন", value: "৪৯ গ্রাম আল্ট্রালাইট" },
        { label: "সেন্সর", value: "PixArt PAW3395 (২৬K DPI)" },
        { label: "পোলিং রেট", value: "৪০০০Hz ওয়্যারলেস" },
        { label: "সুইচ লাইফ", value: "৮০ মিলিয়ন ক্লিক" }
      ],
      en: [
        { label: "Weight", value: "49g Ultralight Skeleton" },
        { label: "Sensor", value: "PixArt PAW3395 (26K DPI)" },
        { label: "Polling Rate", value: "4000Hz Wireless Receiver" },
        { label: "Switch Durability", value: "80 Million Clicks" }
      ],
      zh: [
        { label: "机身重量", value: "49g 极致轻量化" },
        { label: "光学芯片", value: "原相 PAW3395 (26000 DPI)" },
        { label: "回报率", value: "4000Hz 无线纳秒响应" },
        { label: "微动寿命", value: "8000万次 光学防抖微动" }
      ]
    }
  }
];
