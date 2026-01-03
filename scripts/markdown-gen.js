/**
 * scripts/markdown-gen.js
 * Wrapper around Turndown.js to convert HTML to Markdown.
 */

function runTurndown(htmlContent) {
  if (typeof TurndownService === 'undefined') {
    console.error('AI Markdown Crawler: TurndownService is undefined.');
    return '';
  }

  try {
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
      emDelimiter: '*'
    });

    // Custom rules can be added here
    // Example: remove scripts/styles just in case Readability missed them (though Readability usually handles this)
    turndownService.remove('style');
    turndownService.remove('script');

    const markdown = turndownService.turndown(htmlContent);
    return markdown;
  } catch (error) {
    console.error('AI Markdown Crawler: Turndown failed', error);
    return '';
  }
}
