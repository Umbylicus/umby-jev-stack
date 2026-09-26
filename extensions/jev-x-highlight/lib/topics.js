(function (root) {
  const list = [
    ["ai", "AI", "Technology", ["artificial intelligence", "machine learning", "chatgpt", "llm", "openai"]],
    ["software", "Software", "Technology", ["software", "programming", "app", "coding"]],
    ["gadgets", "Gadgets", "Technology", ["gadget", "iphone", "android", "smartphone", "laptop"]],
    ["cybersecurity", "Cybersecurity", "Technology", ["cybersecurity", "hack", "data breach", "ransomware"]],
    ["social-media", "Social media", "Technology", ["social media", "tiktok", "instagram", "youtube"]],
    ["startups", "Startups", "Technology", ["startup", "venture capital", "founder"]],
    ["science", "Science", "Technology", ["science", "research", "study finds"]],
    ["space", "Space", "Technology", ["nasa", "space", "rocket", "satellite"]],
    ["politics", "Politics", "News", ["politics", "political", "policy"]],
    ["elections", "Elections", "News", ["election", "ballot", "campaign", "primary"]],
    ["congress", "Congress", "News", ["congress", "senate", "house of representatives"]],
    ["white-house", "White House", "News", ["white house", "president", "oval office"]],
    ["courts", "Courts", "News", ["supreme court", "lawsuit", "judge", "verdict"]],
    ["world-news", "World news", "News", ["world news", "foreign", "united nations"]],
    ["local-news", "Local news", "News", ["local news", "city council", "mayor"]],
    ["crime", "Crime", "News", ["crime", "arrest", "police", "shooting"]],
    ["immigration", "Immigration", "News", ["immigration", "border", "migrant", "visa"]],
    ["climate", "Climate", "News", ["climate", "wildfire", "hurricane", "emissions"]],
    ["guns", "Guns", "News", ["gun", "firearm", "second amendment"]],
    ["business", "Business", "Money", ["business", "company", "ceo", "earnings"]],
    ["economy", "Economy", "Money", ["economy", "inflation", "jobs report", "recession"]],
    ["markets", "Stock market", "Money", ["stock", "nasdaq", "dow", "shares", "wall street"]],
    ["personal-finance", "Personal finance", "Money", ["budget", "credit card", "savings", "debt"]],
    ["real-estate", "Real estate", "Money", ["real estate", "mortgage", "housing", "rent"]],
    ["jobs", "Jobs", "Money", ["job", "hiring", "layoff", "salary", "career"]],
    ["small-business", "Small business", "Money", ["small business", "shop local", "main street"]],
    ["taxes", "Taxes", "Money", ["tax", "irs", "deduction", "refund"]],
    ["health", "Health", "Health", ["health", "doctor", "hospital", "disease"]],
    ["medicine", "Medicine", "Health", ["medicine", "drug", "vaccine", "fda"]],
    ["fitness", "Fitness", "Health", ["fitness", "workout", "gym", "exercise"]],
    ["mental-health", "Mental health", "Health", ["mental health", "anxiety", "therapy", "depression"]],
    ["nutrition", "Nutrition", "Health", ["nutrition", "diet", "calories", "vitamin"]],
    ["parenting", "Parenting", "Home", ["parenting", "kids", "toddler", "school pickup"]],
    ["home", "Home", "Home", ["home", "renovation", "furniture", "apartment"]],
    ["gardening", "Gardening", "Home", ["garden", "plant", "lawn", "yard"]],
    ["cooking", "Cooking", "Food", ["recipe", "cooking", "bake", "kitchen"]],
    ["food", "Food", "Food", ["food", "restaurant", "grocery"]],
    ["restaurants", "Restaurants", "Food", ["restaurant", "dining", "menu"]],
    ["movies", "Movies", "Entertainment", ["movie", "film", "box office", "cinema"]],
    ["television", "Television", "Entertainment", ["television", "tv show", "series", "streaming"]],
    ["music", "Music", "Entertainment", ["music", "album", "song", "concert"]],
    ["celebrities", "Celebrities", "Entertainment", ["celebrity", "famous", "red carpet"]],
    ["sports", "Sports", "Entertainment", ["sports", "athlete", "game", "tournament"]],
    ["football", "Football", "Entertainment", ["nfl", "football", "touchdown", "quarterback"]],
    ["basketball", "Basketball", "Entertainment", ["nba", "basketball"]],
    ["baseball", "Baseball", "Entertainment", ["mlb", "baseball"]],
    ["soccer", "Soccer", "Entertainment", ["soccer", "mls", "premier league"]],
    ["gaming", "Gaming", "Entertainment", ["video game", "gaming", "playstation", "xbox", "nintendo"]],
    ["books", "Books", "Entertainment", ["book", "novel", "author"]],
    ["comedy", "Comedy", "Entertainment", ["comedy", "stand-up", "funny"]],
    ["podcasts", "Podcasts", "Entertainment", ["podcast"]],
    ["fashion", "Fashion", "Lifestyle", ["fashion", "outfit", "style"]],
    ["beauty", "Beauty", "Lifestyle", ["beauty", "makeup", "skincare"]],
    ["travel", "Travel", "Lifestyle", ["travel", "flight", "vacation", "hotel"]],
    ["cars", "Cars", "Lifestyle", ["car", "truck", "automotive", "ev"]],
    ["motorcycles", "Motorcycles", "Lifestyle", ["motorcycle", "harley"]],
    ["pets", "Pets", "Lifestyle", ["dog", "cat", "pet", "puppy"]],
    ["outdoors", "Outdoors", "Lifestyle", ["hiking", "camping", "fishing", "hunting"]],
    ["photography", "Photography", "Lifestyle", ["photo", "camera", "photography"]],
    ["art", "Art", "Lifestyle", ["art", "museum", "painting"]],
    ["design", "Design", "Lifestyle", ["design", "interior", "architecture"]],
    ["education", "Education", "Society", ["school", "college", "university", "student", "teacher"]],
    ["religion", "Religion", "Society", ["church", "faith", "religion", "mosque", "synagogue"]],
    ["culture", "Culture", "Society", ["culture", "community", "tradition"]],
    ["history", "History", "Society", ["history", "historical", "war"]],
    ["military", "Military", "Society", ["military", "army", "navy", "veteran", "pentagon"]],
    ["weather", "Weather", "Everyday", ["weather", "forecast", "storm", "tornado"]],
    ["shopping", "Shopping", "Everyday", ["shopping", "store", "retail"]],
    ["deals", "Deals", "Everyday", ["deal", "discount", "coupon", "sale"]],
    ["relationships", "Relationships", "Everyday", ["relationship", "marriage", "dating"]],
    ["weddings", "Weddings", "Everyday", ["wedding", "bride", "groom"]],
    ["diy", "DIY", "Everyday", ["diy", "how to", "tutorial"]],
    ["memes", "Memes", "Everyday", ["meme", "viral"]]
  ].map(function (row) {
    return { id: row[0], label: row[1], group: row[2], words: row[3] };
  });

  const byId = {};
  list.forEach(function (topic) { byId[topic.id] = topic; });

  function phrasesFor(ids) {
    const out = [];
    (ids || []).forEach(function (id) {
      const topic = byId[String(id || "").toLowerCase()];
      if (!topic) {
        if (id) out.push(String(id));
        return;
      }
      out.push(topic.label);
      topic.words.forEach(function (word) { out.push(word); });
    });
    return out;
  }

  const api = { list: list, byId: byId, phrasesFor: phrasesFor };
  root.JEVTopics = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
