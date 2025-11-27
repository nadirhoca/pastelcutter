

export async function generateGameAsset(prompt: string, type: 'sprite' | 'background'): Promise<string> {
  // We are now using free internet assets as requested, removing the Google Cloud Paid dependency.
  // Using DiceBear for 8-bit sprites and Picsum for backgrounds.
  
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate slight network delay for effect

  // Simple string hash for deterministic seeds
  const hashCode = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  };

  const seed = hashCode(prompt);

  if (type === 'sprite') {
    // Use 'pixel-art' for player-like entities, 'bottts' for enemies
    const style = prompt.includes('robot') || prompt.includes('enemy') || prompt.includes('boss') 
      ? 'bottts' 
      : 'pixel-art';

    return `https://api.dicebear.com/9.x/${style}/png?seed=${seed}&backgroundColor=transparent&size=128`;
  } else {
    // Backgrounds
    // Use the seed to ensure the background stays the same for the same level prompt
    // Removed grayscale to satisfy user request for colorful backgrounds
    return `https://picsum.photos/seed/${seed}/800/600?blur=2`;
  }
}