// Seed services — demo detail-page content derived from what's already named/implied
// on the existing site (Footer's "Services" column, ShippingComparison, SourcingSection,
// WholesaleSection). Fully editable later from the admin control panel.
module.exports = [
  {
    slug: "air-freight",
    icon: "✈️",
    accentColor: "#DE2910",
    title: { bn: "এয়ার এক্সপ্রেস শিপমেন্ট", en: "Air Express Cargo", zh: "特快专线空运" },
    tagline: { bn: "দ্রুততম ডেলিভারি — ৭–১০ দিন", en: "Fastest Delivery — 7–10 Days", zh: "极速送达 — 7–10 天" },
    body: {
      bn: "জরুরি পণ্য, হাই-ভ্যালু গ্যাজেট, স্যাম্পল ও স্মার্ট ডিভাইসের জন্য সেরা সমাধান। আমরা গুয়াংজু ও শেনঝেন থেকে প্রতিদিন সরাসরি ফ্লাইট কানেকশনের মাধ্যমে আপনার পণ্য মাত্র ৭-১০ দিনে ঢাকা বা চট্টগ্রামে পৌঁছে দিই।\n\nসম্পূর্ণ কাস্টমস ও ট্যাক্স প্রক্রিয়া আমরা নিজেরাই পরিচালনা করি, তাই আপনাকে কোনো অতিরিক্ত ঝামেলা পোহাতে হয় না। প্রতিটি শিপমেন্ট লাইভ ট্র্যাকিংয়ের মাধ্যমে পর্যবেক্ষণ করা যায়।",
      en: "Perfect for high-value electronics, trending gadgets, urgent samples, and fast-moving stock. We move your cargo from Guangzhou and Shenzhen via daily direct flight connections, landing in Dhaka or Chittagong in just 7-10 days.\n\nFull customs duties and taxes are handled end-to-end by our team, so there's nothing extra for you to manage. Every shipment is visible through live transit milestone tracking.",
      zh: "适用于高附加值数码硬件、爆款样品、急单补货及轻量型消费电子。我们从广州/深圳出发，通过每日直飞航班，最快 7-10 天即可送达达卡或吉大港。\n\n我们全程包揽清关与关税申报，客户无需自行处理任何海关手续。每一票货物均可通过全程 GPS 节点进行实时追踪。"
    },
    highlights: {
      bn: ["প্রতিদিন সরাসরি ফ্লাইট কানেকশন", "সম্পূর্ণ কাস্টমস ও ট্যাক্স অন্তর্ভুক্ত", "লাইভ ট্র্যাকিং আপডেট", "৳৮৫০ / কেজি থেকে শুরু"],
      en: ["Daily direct flight connections", "Full customs duties & taxes included", "Live GPS transit milestones", "Starts at ৳850 / kg"],
      zh: ["广州/深圳直飞达卡每日航班", "包清关双清包税一口价", "全程 GPS 节点实时追踪", "低至 ৳850 / KG 起"]
    },
    ctaLabel: { bn: "এয়ার শিপমেন্ট নিয়ে জিজ্ঞাসা করুন", en: "Ask About Air Shipping", zh: "咨询空运方案" },
    sortOrder: 1
  },
  {
    slug: "sea-freight",
    icon: "🚢",
    accentColor: "#C9A227",
    title: { bn: "সি কন্টেইনার ফ্রেইট", en: "Sea Container Freight", zh: "经济集装箱海运" },
    tagline: { bn: "সর্বোচ্চ সাশ্রয়ী — ৪০–৫০ দিন", en: "Maximum Economy — 40–50 Days", zh: "极致性价比 — 40–50 天" },
    body: {
      bn: "ভারী মেশিনারি, ফার্নিচার, পাইকারি কাঁচামাল ও বাল্ক অর্ডারের জন্য নিখুঁত সমাধান। FCL (ফুল কন্টেইনার) ও LCL (শেয়ারড কন্টেইনার) — দুই ধরনের সার্ভিসই আমরা সরবরাহ করি, যাতে ছোট থেকে বড় সব ধরনের অর্ডার সাশ্রয়ীভাবে পরিবহন করা যায়।\n\nচট্টগ্রাম বন্দরে আমাদের নিজস্ব টিম মাল খালাসের পুরো প্রক্রিয়া তদারকি করে, ফলে বিলম্ব ও অতিরিক্ত চার্জের ঝুঁকি কমে যায়।",
      en: "Ideal for heavy industrial machinery, furniture, raw materials, and high-volume container shipments. We offer both FCL (full container load) and LCL (consolidated) options, so orders of any size ship at the lowest possible per-unit cost.\n\nOur on-ground team manages the full release process at Chittagong port terminal, minimizing delays and unexpected charges.",
      zh: "适用于大型工业机械、成套家具、建筑五金、高容积大宗批发货源。我们同时提供整柜（FCL）与拼柜（LCL）两种模式，无论订单大小都能实现最优单位成本。\n\n我们的本地团队全程跟进吉大港保税仓库的分拣与出仓流程，最大程度降低延误与额外费用风险。"
    },
    highlights: {
      bn: ["FCL ও LCL কন্টেইনার সার্ভিস", "সবচেয়ে কম ল্যান্ডেড কস্ট", "চট্টগ্রাম বন্দরে নিরবচ্ছিন্ন খালাস", "৳২০০ / সিবিএম সমতুল্য থেকে শুরু"],
      en: ["FCL & LCL consolidated container options", "Lowest landed per-unit cost", "Direct Chittagong port terminal release", "Starts at ৳200 / CBM equivalent"],
      zh: ["支持整柜 (FCL) 及拼箱 (LCL) 拼柜", "单件商品落地成本最低化", "吉大港保税仓库快速分拣出仓", "低至 ৳200 / CBM 当量起"]
    },
    ctaLabel: { bn: "সি ফ্রেইট নিয়ে জিজ্ঞাসা করুন", en: "Ask About Sea Freight", zh: "咨询海运方案" },
    sortOrder: 2
  },
  {
    slug: "factory-sourcing",
    icon: "🏭",
    accentColor: "#DE2910",
    title: { bn: "ফ্যাক্টরি সোর্সিং ও অডিট", en: "OEM & Factory Audit", zh: "工厂寻源与验厂审计" },
    tagline: { bn: "সরাসরি অরিজিনাল ফ্যাক্টরি, কোনো দালাল নেই", en: "Direct factory access, zero middlemen", zh: "源头直连工厂，杜绝中间商" },
    body: {
      bn: "আমাদের গুয়াংজু ও ইইউ-ভিত্তিক টিম সরাসরি ফিল্ডে গিয়ে ফ্যাক্টরি পরিদর্শন, উৎপাদন সক্ষমতা যাচাই এবং দাম নেগোসিয়েশন করে। আপনি কোনো থার্ড পার্টি দালাল ছাড়াই সরাসরি চীনা প্রস্তুতকারকের সাথে ব্যবসা করতে পারবেন।\n\nফ্যাক্টরি অডিট রিপোর্টে উৎপাদন ক্ষমতা, কোয়ালিটি কন্ট্রোল প্রক্রিয়া এবং রপ্তানি অভিজ্ঞতার বিস্তারিত তথ্য থাকে, যাতে আপনি নিশ্চিন্তে সিদ্ধান্ত নিতে পারেন।",
      en: "Our on-ground team in Guangzhou and Yiwu visits factories in person to verify production capacity, quality systems, and negotiate pricing directly. You trade with authenticated Chinese original factories — no middlemen, no broker markups.\n\nEvery factory audit report covers production capability, QC process, and export track record, so you can make sourcing decisions with confidence.",
      zh: "我们常驻广州与义乌的买手团队亲自实地考察工厂，核实生产能力与品控体系，并直接进行价格谈判。您将直接与经过认证的中国原厂对接，杜绝中间商层层加价。\n\n每份验厂报告都包含产能、质控流程与出口经验的详细说明，帮助您放心做出采购决策。"
    },
    highlights: {
      bn: ["গুয়াংজু ও ইইউতে নিজস্ব অফিস", "সরাসরি ফ্যাক্টরি নেগোসিয়েশন", "স্বচ্ছ অডিট রিপোর্ট", "২৪ ঘণ্টায় কোটেশন"],
      en: ["Physical offices in Guangzhou & Yiwu", "Direct factory-floor negotiation", "Transparent audit reporting", "Factory quotes within 24 hours"],
      zh: ["广州与义乌设有实体办事处", "工厂一线直接议价", "透明验厂报告", "24小时内提供工厂报价"]
    },
    ctaLabel: { bn: "ফ্যাক্টরি অডিট রিকোয়েস্ট করুন", en: "Request a Factory Audit", zh: "申请验厂服务" },
    sortOrder: 3
  },
  {
    slug: "customs-lc-support",
    icon: "🏛️",
    accentColor: "#C9A227",
    title: { bn: "কাস্টমস ও এলসি সাপোর্ট", en: "Customs & LC Support", zh: "关务与信用证支持" },
    tagline: { bn: "ব্যাংকিং, এলসি ও কাস্টমস — সম্পূর্ণ আমরা সামলাই", en: "Banking, LC & customs — fully handled", zh: "银行、信用证与清关一站式代办" },
    body: {
      bn: "আমদানির সবচেয়ে জটিল অংশ — ব্যাংক পেমেন্ট, এলসি (Letter of Credit), টিটি এবং কাস্টমস ডিক্লারেশন — আমরা সম্পূর্ণভাবে পরিচালনা করি। আপনার শুধু পণ্য বাছাই করার দরকার, বাকি কাগজপত্র ও আইনি প্রক্রিয়া আমাদের।\n\nচট্টগ্রাম ও ঢাকা কাস্টমসে আমাদের অভিজ্ঞ টিম রয়েছে, যারা শুল্ক নির্ধারণ থেকে শুরু করে খালাস পর্যন্ত পুরো প্রক্রিয়ায় সহায়তা করে, যাতে কোনো অপ্রত্যাশিত বিলম্ব না হয়।",
      en: "The most complex part of importing — banking payments, Letters of Credit, TT transfers, and customs declarations — is handled completely by our team. You focus on choosing products; we handle the paperwork and regulatory process.\n\nOur experienced team at both Chittagong and Dhaka customs supports everything from duty assessment through final release, so there are no unexpected delays.",
      zh: "进口环节中最复杂的部分——银行付款、信用证 (LC)、电汇 (TT) 及海关申报——完全由我们团队代办。您只需挑选商品，其余单证与合规流程交给我们。\n\n我们在吉大港与达卡海关均有经验丰富的关务团队，从税则核定到最终放行全程协助，最大程度避免意外延误。"
    },
    highlights: {
      bn: ["ব্যাংক পেমেন্ট ও এলসি সহায়তা", "কাস্টমস ট্যাক্স ও ডিক্লারেশন", "চট্টগ্রাম ও ঢাকা কাস্টমস অভিজ্ঞতা", "স্বচ্ছ খরচের হিসাব"],
      en: ["Banking payment & LC assistance", "Customs duty & declaration handling", "Chittagong & Dhaka customs expertise", "Transparent cost breakdowns"],
      zh: ["银行付款与信用证协助", "关税申报全程代办", "吉大港与达卡海关经验", "费用明细透明公开"]
    },
    ctaLabel: { bn: "কাস্টমস সাপোর্ট নিয়ে জিজ্ঞাসা করুন", en: "Ask About Customs Support", zh: "咨询关务服务" },
    sortOrder: 4
  },
  {
    slug: "custom-sourcing",
    icon: "🔍",
    accentColor: "#DE2910",
    title: { bn: "কাস্টম প্রোডাক্ট সোর্সিং", en: "Custom Product Sourcing", zh: "定制产品寻源" },
    tagline: { bn: "৬-ধাপের প্রক্রিয়ায় যেকোনো পণ্য খুঁজে দিই", en: "Any product, sourced through our 6-step roadmap", zh: "六步闭环流程，助您寻获任意商品" },
    body: {
      bn: "আপনার কাঙ্ক্ষিত যেকোনো পণ্যের ছবি, Alibaba লিংক বা স্পেসিফিকেশন শিট আমাদের দিন — বাকিটা আমরা সামলাই। পণ্য রিকোয়েস্ট থেকে শুরু করে সাপ্লায়ার খোঁজা, কোটেশন সংগ্রহ, অর্ডার কনফার্মেশন, শিপিং ও কাস্টমস পার হয়ে শেষ পর্যন্ত ডেলিভারি — প্রতিটি ধাপে আমরা আপনার পাশে থাকি।\n\nআমাদের গুয়াংজু ও ইইউ-ভিত্তিক বায়িং এজেন্টরা মাত্র ২৪ ঘণ্টার মধ্যে ফ্যাক্টরি কোটেশন প্রস্তুত করে দেয়।",
      en: "Share any product photo, Alibaba link, or spec sheet — we handle everything from there. From the initial product request through supplier search, quotation, order confirmation, shipping & customs, all the way to final delivery, we stay with you at every stage.\n\nOur on-ground buying agents in Guangzhou and Yiwu turn around factory quotes within 24 hours.",
      zh: "只需提供产品图片、阿里巴巴链接或规格文档，其余交给我们全权处理。从需求提交、源头寻厂、报价确认、下单锁货，到出口清关与最终验收入库，我们全程陪伴。\n\n我们常驻广州与义乌的买手团队将在 24 小时内为您准备好工厂源头报价单。"
    },
    highlights: {
      bn: ["যেকোনো পণ্যের ছবি বা লিংক দিলেই চলবে", "৬-ধাপের স্বচ্ছ প্রক্রিয়া", "২৪ ঘণ্টায় ফ্যাক্টরি কোটেশন", "স্যাম্পল চেক ও অর্ডার লক"],
      en: ["Works from a photo, link, or spec sheet", "Transparent 6-stage roadmap", "Factory quotes within 24 hours", "Sample verification before order lock"],
      zh: ["仅需图片、链接或规格书即可启动", "六步闭环透明流程", "24小时内提供工厂报价", "锁单前提供样品验收"]
    },
    ctaLabel: { bn: "সোর্সিং রিকোয়েস্ট করুন", en: "Submit a Sourcing Request", zh: "提交寻源需求" },
    sortOrder: 5
  },
  {
    slug: "wholesale-solutions",
    icon: "📦",
    accentColor: "#C9A227",
    title: { bn: "হোলসেল ও বাল্ক অর্ডার সলিউশন", en: "Wholesale & Bulk Order Solutions", zh: "大宗批发解决方案" },
    tagline: { bn: "বাংলাদেশের রিটেইলার ও ব্র্যান্ড ওনারদের জন্য", en: "Built for Bangladesh retailers & brand owners", zh: "专为孟加拉零售商与品牌商打造" },
    body: {
      bn: "বাংলাদেশের রিটেইলার, শোরুম মালিক ও পাইকারি ব্যবসায়ীদের জন্য বিশেষায়িত এন্ড-টু-এন্ড চায়না ইমপোর্ট সাপোর্ট। ফ্যাক্টরি ডিরেক্ট প্রাইসিং, এলসি/টিটি ও কাস্টমস ম্যানেজমেন্ট এবং কাস্টম ব্র্যান্ডিং (OEM ও প্রাইভেট লেবেল) — সবকিছু একই ছাদের নিচে।\n\nআপনার নিজস্ব লোগো, কাস্টমাইজড বক্স প্যাকেজিং এবং প্রোডাক্ট স্পেসিফিকেশন অনুযায়ী বড় পরিমাণে অর্ডার করার সুবিধা নিন। আমাদের ল্যান্ডেড কস্ট ক্যালকুলেটর দিয়ে আগেই সঠিক খরচ জেনে নিন।",
      en: "End-to-end import solutions tailored for Bangladesh retailers, brand owners, and wholesale merchants. Factory-direct pricing, LC/TT & customs handling, and custom OEM/private-label branding — all under one roof.\n\nPrint your own logo, get personalized box packaging, and tailor product specs at scale. Use our landed-cost calculator up front to know your real numbers before you commit.",
      zh: "面向孟加拉国零售商、品牌商与批发商的端到端中国采购解决方案。源头工厂底价、信用证/电汇与清关代办、OEM 定制与私有品牌——一站式满足。\n\n支持定制印标、专属包装彩盒及规格量身定制的大宗订单。下单前可先用我们的落地成本测算工具，提前掌握真实成本。"
    },
    highlights: {
      bn: ["কোনো থার্ড পার্টি দালাল নেই", "এলসি/টিটি ও কাস্টমস সম্পূর্ণ সহায়তা", "কাস্টম লোগো ও প্যাকেজিং (OEM)", "ল্যান্ডেড কস্ট ক্যালকুলেটর"],
      en: ["Bypass middlemen and broker fees", "Complete LC/TT & customs assistance", "Custom logo & packaging (OEM/private label)", "Built-in landed cost calculator"],
      zh: ["剔除中间商层层加价", "信用证/电汇与清关全程协助", "定制印标与包装 (OEM/私有品牌)", "内置落地成本测算工具"]
    },
    ctaLabel: { bn: "হোলসেল ডিল আলোচনা করুন", en: "Discuss a Wholesale Deal", zh: "洽谈大宗采购" },
    sortOrder: 6
  }
];
