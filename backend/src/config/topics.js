/**
 * Кураторская подборка тем для создания контента
 * Разделены по категориям для удобной навигации
 */

export const TOPICS = [
  {
    id: 'war-security',
    category: '🪖 Война / Безопасность',
    icon: '🪖',
    color: '#ff4d4f',
    topics: [
      {
        id: 'europe-war-change',
        title: 'Как изменилась Европа из-за войны в Украине?',
        description: 'Аналитика, инфографика, рост военных бюджетов',
        keywords: ['Ukraine war Europe', 'European defense budget', 'NATO expansion', 'European security'],
        searchQueries: [
          'Ukraine war impact Europe',
          'European military spending increase',
          'How Ukraine war changed Europe',
          'Europe defense budget 2024 2025'
        ]
      },
      {
        id: 'europe-draft',
        title: 'Будет ли призыв в Европу?',
        description: 'Страхи, фейки, реалии мобилизации',
        keywords: ['Europe conscription', 'European draft', 'military mobilization Europe', 'NATO draft'],
        searchQueries: [
          'Will Europe bring back draft',
          'European conscription debate',
          'Military mobilization Europe',
          'NATO countries military service'
        ]
      },
      {
        id: 'us-defense-budget',
        title: 'Почему США снова тратят рекордный оборонный бюджет?',
        description: 'Простым языком о ВПК',
        keywords: ['US defense budget', 'Pentagon spending', 'military industrial complex', 'US military budget'],
        searchQueries: [
          'US defense budget 2025',
          'Why US military spending increasing',
          'Pentagon budget explained',
          'US military industrial complex'
        ]
      },
      {
        id: 'nordic-war-prep',
        title: 'Северная Европа готовится к войне?',
        description: 'НАТО, Финляндия, Швеция, Норвегия',
        keywords: ['Finland NATO', 'Sweden NATO', 'Nordic defense', 'Scandinavia military'],
        searchQueries: [
          'Finland Sweden NATO membership',
          'Nordic countries preparing for war',
          'Scandinavia defense strategy',
          'Norway Finland Sweden military'
        ]
      },
      {
        id: 'russia-nato-balance',
        title: 'Будущее России и НАТО: куда движется баланс сил?',
        description: 'Нейтральный обзор для широкой аудитории',
        keywords: ['Russia NATO', 'power balance', 'military balance', 'geopolitics'],
        searchQueries: [
          'Russia NATO power balance',
          'Future of Russia NATO relations',
          'Military balance Europe Russia',
          'Geopolitics Russia NATO 2025'
        ]
      }
    ]
  },
  {
    id: 'ecology-climate',
    category: '🌍 Экология / Климат',
    icon: '🌍',
    color: '#52c41a',
    topics: [
      {
        id: 'europe-climate-disasters',
        title: 'Почему Европа снова горит и тонет?',
        description: 'Пожары, наводнения, последствия',
        keywords: ['Europe wildfires', 'European floods', 'climate change Europe', 'extreme weather'],
        searchQueries: [
          'Europe wildfires 2025',
          'European floods climate change',
          'Extreme weather Europe',
          'Climate disasters Europe'
        ]
      },
      {
        id: 'green-energy-debate',
        title: 'Зелёная энергия или зелёный обман?',
        description: 'Спор о ветряках и электромобилях',
        keywords: ['green energy', 'wind turbines debate', 'electric vehicles', 'renewable energy'],
        searchQueries: [
          'Green energy debate',
          'Are wind turbines worth it',
          'Electric vehicles pros cons',
          'Renewable energy greenwashing'
        ]
      },
      {
        id: 'climate-migration',
        title: 'Климатическая миграция — новое переселение народов',
        description: 'Люди бегут от жары',
        keywords: ['climate refugees', 'climate migration', 'environmental migration', 'climate change migration'],
        searchQueries: [
          'Climate refugees crisis',
          'Climate migration explained',
          'People fleeing climate change',
          'Climate induced migration'
        ]
      },
      {
        id: 'life-without-oil',
        title: 'Как мы будем жить без нефти?',
        description: 'Энергетика 2035-го простыми словами',
        keywords: ['post oil world', 'energy future', 'oil alternatives', 'renewable energy future'],
        searchQueries: [
          'Life without oil',
          'Future of energy 2035',
          'Oil alternatives explained',
          'Post petroleum economy'
        ]
      },
      {
        id: 'future-food',
        title: 'Еда будущего: черви, водоросли и 3D-мясо',
        description: 'Шокирующе, но интересно',
        keywords: ['insect food', 'lab grown meat', '3D printed food', 'future of food'],
        searchQueries: [
          'Eating insects future food',
          'Lab grown meat explained',
          '3D printed meat',
          'Alternative protein sources'
        ]
      }
    ]
  },
  {
    id: 'politics-society',
    category: '🏛️ Политика / Общество',
    icon: '🏛️',
    color: '#1890ff',
    topics: [
      {
        id: 'europe-political-correctness',
        title: 'Почему Европа устала от политкорректности?',
        description: 'Честно о перегибах',
        keywords: ['political correctness backlash', 'Europe woke culture', 'cancel culture Europe', 'free speech'],
        searchQueries: [
          'Political correctness backlash Europe',
          'Europe tired of woke culture',
          'Cancel culture debate',
          'Free speech Europe'
        ]
      },
      {
        id: 'migration-identity',
        title: 'Миграция и идентичность: кто мы теперь?',
        description: 'Мультикультурная Европа',
        keywords: ['European identity', 'multiculturalism Europe', 'immigration identity', 'cultural identity'],
        searchQueries: [
          'European identity crisis',
          'Multiculturalism debate Europe',
          'Immigration changing Europe',
          'Cultural identity Europe'
        ]
      },
      {
        id: 'canada-immigration',
        title: 'Канада — новая империя эмигрантов?',
        description: 'Как иммиграция меняет страну',
        keywords: ['Canada immigration', 'Canadian immigration policy', 'immigration Canada', 'Canada diversity'],
        searchQueries: [
          'Canada immigration 2025',
          'How immigration changed Canada',
          'Canadian immigration policy',
          'Canada most diverse country'
        ]
      },
      {
        id: 'france-protests',
        title: 'Франция после протестов: куда идёт демократия?',
        description: 'Демократия под вопросом',
        keywords: ['France protests', 'French democracy', 'gilets jaunes', 'France social unrest'],
        searchQueries: [
          'France protests 2025',
          'French democracy crisis',
          'Social unrest France',
          'France political situation'
        ]
      },
      {
        id: 'germany-trust-crisis',
        title: 'Германия и кризис доверия к политике',
        description: 'Рост популизма и AfD',
        keywords: ['Germany politics', 'AfD rise', 'German populism', 'trust crisis Germany'],
        searchQueries: [
          'Germany political crisis',
          'AfD popularity Germany',
          'German politics 2025',
          'Trust in German government'
        ]
      }
    ]
  },
  {
    id: 'tech-economy',
    category: '💡 Технологии / Экономика',
    icon: '💡',
    color: '#722ed1',
    topics: [
      {
        id: 'ai-control',
        title: 'Кто контролирует будущее ИИ?',
        description: 'США против Европы и Китая',
        keywords: ['AI control', 'artificial intelligence regulation', 'AI race', 'AI governance'],
        searchQueries: [
          'Who controls AI future',
          'AI regulation USA Europe China',
          'Artificial intelligence race',
          'AI governance debate'
        ]
      },
      {
        id: 'robots-unemployment',
        title: 'Налоги, роботы и безработица: новая экономика',
        description: 'Что ждёт Европу',
        keywords: ['automation unemployment', 'robot tax', 'future of work', 'basic income'],
        searchQueries: [
          'Automation unemployment Europe',
          'Robot tax debate',
          'Future of work AI',
          'Universal basic income'
        ]
      },
      {
        id: 'digital-currency',
        title: 'Цифровое Евро и доллар: зачем нам электронные деньги?',
        description: 'Будущее финансов',
        keywords: ['digital euro', 'CBDC', 'digital dollar', 'cryptocurrency'],
        searchQueries: [
          'Digital euro explained',
          'CBDC central bank digital currency',
          'Digital dollar vs bitcoin',
          'Future of money digital'
        ]
      },
      {
        id: 'ev-market-battle',
        title: 'Tesla, BYD и будущее авто',
        description: 'Битва за рынок EV в Европе и США',
        keywords: ['Tesla vs BYD', 'electric vehicles market', 'EV competition', 'China EV Europe'],
        searchQueries: [
          'Tesla vs BYD comparison',
          'Electric vehicle market 2025',
          'Chinese EV cars Europe',
          'Future of electric cars'
        ]
      }
    ]
  }
];

/**
 * Получить все темы плоским списком
 */
export const getAllTopics = () => {
  const allTopics = [];
  TOPICS.forEach(category => {
    category.topics.forEach(topic => {
      allTopics.push({
        ...topic,
        categoryId: category.id,
        categoryName: category.category,
        categoryIcon: category.icon,
        categoryColor: category.color
      });
    });
  });
  return allTopics;
};

/**
 * Получить тему по ID
 */
export const getTopicById = (topicId) => {
  for (const category of TOPICS) {
    const topic = category.topics.find(t => t.id === topicId);
    if (topic) {
      return {
        ...topic,
        categoryId: category.id,
        categoryName: category.category,
        categoryIcon: category.icon,
        categoryColor: category.color
      };
    }
  }
  return null;
};

/**
 * Получить темы по категории
 */
export const getTopicsByCategory = (categoryId) => {
  const category = TOPICS.find(c => c.id === categoryId);
  return category ? category.topics : [];
};

/**
 * Получить статистику
 */
export const getTopicsStats = () => {
  return {
    totalCategories: TOPICS.length,
    totalTopics: TOPICS.reduce((sum, cat) => sum + cat.topics.length, 0),
    categories: TOPICS.map(cat => ({
      id: cat.id,
      name: cat.category,
      icon: cat.icon,
      count: cat.topics.length
    }))
  };
};

export default TOPICS;
