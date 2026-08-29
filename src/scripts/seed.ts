/**
 * Seed script — populates the database with demo data for local exploration.
 * Run: npm run seed
 */
import mongoose, { Types } from "mongoose";
import { connect as dbConnect, connection } from "mongoose";
import { User, Business, BusinessMember, Post, Product, Follow, Like, Comment, Conversation, Message, Order, Review, Advertisement, Sound } from "@/server/models";
import { hashPassword } from "@/lib/password";
import { computePostScore, extractHashtags } from "@/services/feed-scoring";

const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/buybuy";

const pick = <T,>(arr: T[], i: number): T => arr[i % arr.length]!;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);

interface SeedBusiness {
  name: string;
  category: string;
  city: string;
  country: string;
  currency: string;
  bio: string;
  owner: { name: string; email: string };
  posts: string[];
  products?: { name: string; priceCents: number; description: string }[];
}

const SEED_BUSINESSES: SeedBusiness[] = [
  {
    name: "Amara's Shea Butter",
    category: "beauty",
    city: "Lagos",
    country: "Nigeria",
    currency: "NGN",
    bio: "Handcrafted shea butter skincare from Accra recipes. 100% natural, women-cooperative sourced.",
    owner: { name: "Amara Diallo", email: "amara@buybuy.demo" },
    posts: [
      "New batch of whipped shea butter just dropped 🧴✨ Made with love and 100% natural ingredients. #skincare #sheabutter #naturalbeauty",
      "Behind the scenes: how we source our shea nuts directly from women cooperatives in northern Ghana 🇬🇭 #fairtrade #behindthescenes",
      "3 ways to use shea butter for glowing skin this harmattan season ❄️ Save this post! #skincaretips",
    ],
    products: [
      { name: "Whipped Shea Butter 250g", priceCents: 350000, description: "Our signature whipped shea butter, lightly scented with vanilla." },
      { name: "Black Soap Cleanser", priceCents: 180000, description: "Traditional African black soap in a gentle liquid formula." },
    ],
  },
  {
    name: "Tokyo Ramen House",
    category: "food",
    city: "Osaka",
    country: "Japan",
    currency: "USD",
    bio: "Authentic tonkotsu ramen, 18-hour broth. Family run since 1987.",
    owner: { name: "Kenji Sato", email: "kenji@buybuy.demo" },
    posts: [
      "18 hours. That's how long our tonkotsu broth simmers every single day. Come taste the difference 🍜 #ramen #tonkotsu",
      "Friday special: spicy miso ramen with ajitama egg 🌶️🥚 Only 50 bowls available! #ramenlover",
    ],
    products: [
      { name: "Ramen Bowl for Two", priceCents: 4200, description: "Two signature tonkotsu ramen bowls + gyoza." },
    ],
  },
  {
    name: "Sahara Threads",
    category: "fashion",
    city: "Marrakech",
    country: "Morocco",
    currency: "EUR",
    bio: "Modern Moroccan textiles & apparel. Handwoven by artisan families.",
    owner: { name: "Yasmine El Fassi", email: "yasmine@buybuy.demo" },
    posts: [
      "The new Atlas collection is here 🧥 Handwoven wool jackets, made by 12 artisan families in the Atlas Mountains. #slowfashion #morocco",
      "Did you know? Every Sabra silk piece takes 3 days to weave by hand. Fashion with a story ✨ #artisan #handmade",
    ],
    products: [
      { name: "Atlas Wool Jacket", priceCents: 18900, description: "Handwoven merino wool jacket with Berber patterns." },
      { name: "Sabra Silk Scarf", priceCents: 5900, description: "Vegetable-dyed cactus silk, one of a kind." },
    ],
  },
  {
    name: "Silicon Tech Repairs",
    category: "technology",
    city: "Austin",
    country: "United States",
    currency: "USD",
    bio: "Fast, honest device repair. Same-day service on phones, laptops and tablets.",
    owner: { name: "Marcus Reed", email: "marcus@buybuy.demo" },
    posts: [
      "PSA: your laptop fan is probably full of dust. Here's a 60-second guide to know when it's time for a clean 💻 #techTips",
      "We just went paperless! All repair tickets are now digital — get live status updates by text 📱 #smallbusiness",
    ],
    products: [
      { name: "Phone Screen Repair", priceCents: 8900, description: "Same-day screen replacement for iPhone & Android. Parts + labor." },
    ],
  },
  {
    name: "Verde Fitness Studio",
    category: "fitness",
    city: "Bogotá",
    country: "Colombia",
    currency: "USD",
    bio: "Community-first fitness. Group classes, personal training and open gym.",
    owner: { name: "Sofía Ramírez", email: "sofia@buybuy.demo" },
    posts: [
      "Monday 6am class was FULL this week 🔥 Love the energy, Verde fam! Who's coming Wednesday? #fitness #community",
      "Trainer tip of the week: progressive overload isn't about ego lifting — it's about consistency. Small wins daily 💪 #fitfam",
    ],
    products: [
      { name: "10-Class Pass", priceCents: 12000, description: "Valid for any group class, 3-month expiry." },
    ],
  },
];

async function seed() {
  // No-fake-users policy (addendum #24): demo fixtures are for development only.
  // Production databases must never be populated with synthetic accounts —
  // override deliberately with SEED_DEMO_DATA=1 if you truly know what you're doing.
  if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO_DATA !== "1") {
    console.error("Refusing to seed demo data with NODE_ENV=production.");
    console.error("The BuyBuy no-fake-users policy forbids synthetic accounts in production.");
    console.error("Set SEED_DEMO_DATA=1 to override (not recommended).");
    process.exit(1);
  }

  console.log("Connecting to", MONGODB_URI);
  await dbConnect(MONGODB_URI);

  // idempotent: clear previous demo data
  const existing = await User.findOne({ email: "demo@buybuy.demo" });
  if (existing) {
    console.log("Demo data already present — clearing and reseeding…");
    await Promise.all([
      User.deleteMany({}),
      Business.deleteMany({}),
      BusinessMember.deleteMany({}),
      Post.deleteMany({}),
      Product.deleteMany({}),
      Follow.deleteMany({}),
      Like.deleteMany({}),
      Comment.deleteMany({}),
      Conversation.deleteMany({}),
      Message.deleteMany({}),
      Order.deleteMany({}),
      Review.deleteMany({}),
      Advertisement.deleteMany({}),
      Sound.deleteMany({}),
    ]);
  }

  const passwordHash = await hashPassword("password123");

  // ---- buyer users ----
  const buyerNames = [
    ["Demo Buyer", "demo@buybuy.demo"],
    ["Chen Wei", "chen@buybuy.demo"],
    ["Fatima Hassan", "fatima@buybuy.demo"],
    ["Lucas Silva", "lucas@buybuy.demo"],
    ["Priya Sharma", "priya@buybuy.demo"],
  ];
  const buyers = [];
  for (let i = 0; i < buyerNames.length; i++) {
    const [name, email] = buyerNames[i]!;
    buyers.push(
      await User.create({
        username: slug(name!) || `user${i}`,
        email,
        passwordHash,
        name,
        emailVerifiedAt: new Date(),
        bio: pick(["Loves discovering small businesses.", "Shopping local, always.", "Here for the food content.", ""], i),
      })
    );
  }
  console.log(`Created ${buyers.length} buyers`);

  // ---- admin user ----
  await User.create({
    username: "admin",
    email: "admin@buybuy.demo",
    passwordHash,
    name: "BuyBuy Admin",
    emailVerifiedAt: new Date(),
    role: "admin",
    bio: "Platform administration.",
  });
  console.log("Created admin (admin@buybuy.demo)");

  // ---- businesses + owners + posts + products ----
  let postIndex = 0;
  const allPosts: { doc: mongoose.Document<Types.ObjectId> & { scoreCache?: number }; businessId: Types.ObjectId | null }[] = [];

  for (let b = 0; b < SEED_BUSINESSES.length; b++) {
    const spec = SEED_BUSINESSES[b]!;
    const owner = await User.create({
      username: slug(spec.owner.name),
      email: spec.owner.email,
      passwordHash,
      name: spec.owner.name,
      role: "business",
      emailVerifiedAt: new Date(),
    });

    const business = await Business.create({
      ownerUserId: owner._id,
      username: slug(spec.name),
      name: spec.name,
      description: spec.bio,
      category: spec.category,
      subcategory: "",
      city: spec.city,
      country: spec.country,
      currency: spec.currency,
      verification: b < 2 ? "verified" : "unverified",
      verifiedAt: b < 2 ? new Date() : null,
      followersCount: 0,
      allowCalls: true,
      allowOrders: true,
    });

    await BusinessMember.create({ businessId: business._id, userId: owner._id, role: "owner" });

    // products
    if (spec.products) {
      for (const p of spec.products) {
        await Product.create({
          businessId: business._id,
          kind: "product",
          name: p.name,
          description: p.description,
          priceCents: p.priceCents,
          currency: spec.currency,
          stock: 25,
          category: spec.category,
          variants: [],
          available: true,
        });
      }
    }

    // posts with staggered timestamps + engagement
    for (let pi = 0; pi < spec.posts.length; pi++) {
      const caption = spec.posts[pi]!;
      const createdAt = new Date(Date.now() - (postIndex * 7 + 2) * 3600_000);
      const likesCount = ((postIndex * 13 + b * 7) % 40) + 4;
      const commentsCount = (postIndex % 5) + 1;
      const sharesCount = postIndex % 3;
      const savesCount = (postIndex * 3) % 9;
      const viewsCount = likesCount * 9 + commentsCount * 15;
      const post = await Post.create({
        businessId: business._id,
        authorUserId: owner._id,
        type: pi === 0 ? "video" : "text",
        caption,
        mediaKeys: [],
        hashtags: extractHashtags(caption),
        status: "published",
        likesCount,
        commentsCount,
        sharesCount,
        savesCount,
        viewsCount,
        productIds: [],
        createdAt,
        updatedAt: createdAt,
      });
      const doc = post as unknown as { scoreCache?: number };
      doc.scoreCache = computePostScore({
        likes: likesCount,
        comments: commentsCount,
        shares: sharesCount,
        saves: savesCount,
        followsGenerated: 0,
        productClicks: 0,
        contactClicks: 0,
        views: viewsCount,
        reports: 0,
        createdAtMs: createdAt.getTime(),
        nowMs: Date.now(),
        newBusiness: b < 2,
      });
      await Post.updateOne({ _id: post._id }, { $set: { scoreCache: doc.scoreCache } });
      allPosts.push({ doc: post as never, businessId: business._id as Types.ObjectId });

      // comments from buyers
      const commentBodies = [
        "This looks amazing! 😍",
        "How much for shipping to Europe?",
        "Just ordered, can't wait!",
        "Love what you're doing 🔥",
        "Do you ship internationally?",
      ];
      for (let ci = 0; ci < Math.min(commentsCount, commentBodies.length); ci++) {
        await Comment.create({
          postId: post._id,
          userId: pick(buyers, postIndex + ci)!._id,
          text: commentBodies[ci]!,
          status: "visible",
          likesCount: 0,
        });
      }
      postIndex++;
    }

    // reviews
    await Review.create({
      businessId: business._id,
      userId: buyers[b % buyers.length]!._id,
      rating: 5 - (b % 2),
      text: pick(
        [
          "Fantastic quality and super fast delivery. Highly recommend!",
          "Great customer service, will definitely buy again.",
          "Exactly as described. Five stars well earned.",
        ],
        b
      ),
      status: "visible",
    });

    console.log(`Seeded ${spec.name}`);
  }

  // recalc ratings
  for (const spec of SEED_BUSINESSES) {
    const biz = await Business.findOne({ username: slug(spec.name) });
    if (!biz) continue;
    const agg = await Review.aggregate<{ avg: number; count: number }>([
      { $match: { businessId: biz._id, status: "visible" } },
      { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    if (agg[0]) {
      biz.ratingAvg = Math.round(agg[0].avg * 10) / 10;
      biz.reviewsCount = agg[0].count;
      await biz.save();
    }
  }

  // ---- follows & likes ----
  const businesses = await Business.find({});
  for (const buyer of buyers) {
    for (const biz of businesses) {
      if (Math.random() < 0.6) {
        await Follow.create({ userId: buyer._id, businessId: biz._id });
        await Business.updateOne({ _id: biz._id }, { $inc: { followersCount: 1 } });
      }
    }
    for (const p of allPosts.slice(0, 6)) {
      if (Math.random() < 0.7) {
        await Like.create({ userId: buyer._id, postId: p.doc._id }).catch(() => {});
      }
    }
  }
  // make sure demo buyer follows everything (so Following tab has content)
  for (const biz of businesses) {
    await Follow.updateOne({ userId: buyers[0]!._id, businessId: biz._id }, { $setOnInsert: { userId: buyers[0]!._id, businessId: biz._id } }, { upsert: true });
  }

  // ---- personal creator content (everyone can post & be followed) ----
  if (buyers[1]) {
    const creator = buyers[1];
    const creatorPosts = [
      "Trying a new skincare routine this week 🧴 — let me know what works for you!",
      "Coffee review: that little roastery downtown is criminally underrated ☕",
      "Weekend cooking attempt #12 — watch me burn nothing this time 🍳",
    ];
    for (let ci = 0; ci < creatorPosts.length; ci++) {
      const createdAt = new Date(Date.now() - (ci * 9 + 3) * 3600_000);
      const likes = (ci * 11) % 30;
      const views = likes * 8 + 12;
      const post = await Post.create({
        businessId: null,
        authorUserId: creator._id,
        authorType: "user",
        type: "text",
        caption: creatorPosts[ci]!,
        mediaKeys: [],
        thumbnailKey: null,
        hashtags: extractHashtags(creatorPosts[ci]!),
        productIds: [],
        visibility: "public",
        status: "published",
        likesCount: likes,
        commentsCount: ci,
        sharesCount: 0,
        savesCount: ci % 2,
        viewsCount: views,
        followsGenerated: 0,
        productClicks: 0,
        contactClicks: 0,
        reportsCount: 0,
        scoreCache: computePostScore({
          likes,
          comments: ci,
          shares: 0,
          saves: ci % 2,
          followsGenerated: 0,
          productClicks: 0,
          contactClicks: 0,
          views,
          reports: 0,
          createdAtMs: createdAt.getTime(),
          nowMs: Date.now(),
          newBusiness: true,
        }),
        createdAt,
        updatedAt: createdAt,
      });
      await Post.updateOne({ _id: post._id }, { $set: { scoreCache: post.scoreCache } });
      allPosts.push({ doc: post as never, businessId: null });
    }
    await User.updateOne({ _id: creator._id }, { $inc: { postsCount: creatorPosts.length } });
    // have the other buyer follow the creator
    if (buyers[0] && String(buyers[0]._id) !== String(creator._id)) {
      await Follow.updateOne(
        { userId: buyers[0]._id, followedUserId: creator._id },
        { $setOnInsert: { userId: buyers[0]._id, followedUserId: creator._id, businessId: null, followingType: "user" } },
        { upsert: true }
      );
      await User.updateOne({ _id: creator._id }, { $inc: { followersCount: 1 } });
    }
  }

  // ---- conversation between demo buyer and first business ----
  const firstBiz = businesses[0]!;
  const conv = await Conversation.create({
    userSideId: buyers[0]!._id,
    businessId: firstBiz._id,
    lastMessageAt: new Date(),
    unreadForUser: 1,
    unreadForBusiness: 0,
  });
  await Message.create({
    conversationId: conv._id,
    senderType: "user",
    senderUserId: buyers[0]!._id,
    text: "Hi! Is the whipped shea butter still available? 🙌",
    readAt: new Date(),
  });
  await Message.create({
    conversationId: conv._id,
    senderType: "business",
    senderUserId: firstBiz.ownerUserId,
    text: "Yes it is! We ship worldwide 🌍 Use code WELCOME10 for 10% off.",
  });

  // ---- sample paid order ----
  const product = await Product.findOne({});
  if (product) {
    await Order.create({
      customerId: buyers[1]!._id,
      businessId: product.businessId,
      items: [{ productId: product._id, name: product.name, priceCents: product.priceCents, quantity: 1 }],
      subtotalCents: product.priceCents,
      feeCents: Math.round(product.priceCents * 0.05),
      totalCents: product.priceCents + Math.round(product.priceCents * 0.05),
      currency: product.currency,
      status: "paid",
      customerContact: { name: "Chen Wei" },
      reference: `BB-${Date.now().toString(36).toUpperCase()}`,
    });
  }

  // ---- shared sound library (TikTok-style) ----
  const demoSounds = [
    { title: "Viral Beat 001", artist: "BuyBuy Audio", official: true },
    { title: "Morning Grind", artist: "DJ Noura", official: false },
    { title: "Chill Vibes", artist: "Kenji & The Ramen Band", official: false },
    { title: "New Beginnings", artist: "Sahara Sounds", official: false },
  ];
  const soundDocs = [];
  for (let si = 0; si < demoSounds.length; si++) {
    const s = demoSounds[si]!;
    const creator = buyers[si % buyers.length]!;
    const sound = await Sound.create({
      creatorUserId: creator._id,
      title: s.title,
      artist: s.artist,
      audioKey: `sounds/demo-${si}.mp3`,
      usesCount: (si * 3) % 12,
      durationSec: 15 + si,
      official: s.official,
    });
    soundDocs.push(sound);
  }
  // attach a sound to a video post so the Reels feed demonstrates sound attribution
  const videoPost = await Post.findOne({ type: "video" });
  if (videoPost && soundDocs[0]) {
    await Post.updateOne({ _id: videoPost._id }, { $set: { soundId: soundDocs[0]._id } });
  }
  console.log(`Created ${demoSounds.length} sounds`);

  const counts = {
    users: await User.countDocuments(),
    businesses: await Business.countDocuments(),
    posts: await Post.countDocuments(),
    products: await Product.countDocuments(),
    follows: await Follow.countDocuments(),
    sounds: await Sound.countDocuments(),
  };
  console.log("Seed complete:", counts);
  console.log("\nDemo logins (password: password123)");
  console.log("  Buyer:    demo@buybuy.demo");
  console.log("  Business: amara@buybuy.demo");
  console.log("  Admin:    admin@buybuy.demo");
  await connection.close();
}

seed().catch(async (err) => {
  console.error(err);
  await connection.close().catch(() => {});
  process.exit(1);
});
