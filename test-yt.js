import play from "play-dl";

async function test() {
  console.log("Searching with play-dl for 'Beach House Space Song'...");
  const searchResults = await play.search("Beach House Space Song", { limit: 1 });
  if (searchResults.length > 0) {
    const video = searchResults[0];
    console.log("Found Video:", video.title, video.url);
    const stream = await play.stream(video.url);
    console.log("Stream stream_type:", stream.type);
    console.log("Stream readable:", stream.stream !== undefined);
  }
}

test().catch(console.error);
