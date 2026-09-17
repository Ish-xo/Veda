import { YouTube } from "youtube-sr";

async function testTrending() {
  console.log("Searching trending music...");
  const trending = await YouTube.search("Top global music hits", { limit: 5 });
  console.log("Trending results count:", trending.length);
  trending.forEach((t, i) => console.log(`${i+1}. ${t.title} (${t.channel?.name}) - ${t.id}`));
}

testTrending().catch(console.error);
