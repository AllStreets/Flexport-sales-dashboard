const axios = require('axios');

// Aggregate data from multiple sources
async function aggregateCompanyData(companyName) {
  try {
    const newsData = await fetchNewsAPI(companyName);
    const searchData = await fetchSerperAPI(companyName);

    return {
      companyName,
      news: newsData,
      searchResults: searchData,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error aggregating data:', error);
    return { companyName, error: 'Failed to aggregate data' };
  }
}

// Fetch recent news from NewsAPI
async function fetchNewsAPI(companyName) {
  try {
    const response = await axios.get('https://newsapi.org/v2/everything', {
      params: {
        q: `"${companyName}" AND (import OR "supply chain" OR freight OR customs OR sourcing OR logistics)`,
        sortBy: 'publishedAt',
        language: 'en',
        pageSize: 5,
        apiKey: process.env.NEWSAPI_KEY || process.env.NEWS_API_KEY
      }
    });

    return response.data.articles.map(article => ({
      title: article.title,
      description: article.description,
      url: article.url,
      publishedAt: article.publishedAt
    }));
  } catch (error) {
    console.error('NewsAPI error:', error.message);
    return [];
  }
}

// Fetch search results from Serper API (or fallback to basic Google search)
async function fetchSerperAPI(companyName) {
  try {
    if (!process.env.SERPER_API_KEY) {
      console.log('Serper API key not configured, using mock data');
      return [];
    }

    const response = await axios.post('https://google.serper.dev/search', {
      q: `${companyName} import sourcing supply chain logistics freight`
    }, {
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    return response.data.organic.slice(0, 5).map(result => ({
      title: result.title,
      snippet: result.snippet,
      link: result.link
    }));
  } catch (error) {
    console.error('Serper API error:', error.message);
    return [];
  }
}

module.exports = { aggregateCompanyData };
