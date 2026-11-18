import { ProductUnit } from '../core/models';

export type CategorySlug = 'leafy' | 'green' | 'root' | 'seasonal' | 'herbs';

export interface VegetableTemplate {
  /** Photo file name in the API's /images/catalog folder. */
  key: string;
  name: string;
  category: CategorySlug;
  unit: ProductUnit;
  price: number;
  step: number;
  stock: number;
  keywords: string[];
  description: string;
}

const kg = (key: string, name: string, category: CategorySlug, price: number, keywords: string[], description: string, step = 0.25, stock = 10): VegetableTemplate =>
  ({ key, name, category, unit: 'Kg', price, step, stock, keywords, description });
const each = (unit: ProductUnit, key: string, name: string, category: CategorySlug, price: number, keywords: string[], description: string, stock = 20): VegetableTemplate =>
  ({ key, name, category, unit, price, step: 1, stock, keywords, description });

/** Common Indian vegetables with typical retail prices, used for quick-add and the photo library. */
export const VEGETABLE_CATALOG: VegetableTemplate[] = [
  kg('tomato', 'Tomato', 'seasonal', 30, ['tomato', 'tamatar', 'thakkali'], 'Vine-ripened country tomatoes — juicy, tangy and deep red.'),
  kg('onion', 'Onion', 'root', 45, ['onion', 'pyaz', 'pyaaz', 'ullipaya', 'ulli'], 'Firm red onions with a sharp, sweet bite.', 0.25, 25),
  kg('potato', 'Potato', 'root', 35, ['potato', 'aloo', 'alu', 'bangaladumpa'], 'Clean, starchy potatoes that roast golden and mash creamy.', 0.25, 25),
  kg('green-chilli', 'Green Chilli', 'green', 40, ['chilli', 'chili', 'mirchi', 'mirapakaya'], 'Glossy, fiery green chillies picked this morning.', 0.1, 5),
  kg('carrot', 'Carrot', 'root', 60, ['carrot', 'gajar'], 'Crunchy, naturally sweet carrots.'),
  kg('beans', 'Beans', 'green', 50, ['beans', 'french bean', 'green bean'], 'Tender French beans that snap when bent.'),
  each('Piece', 'cabbage', 'Cabbage', 'leafy', 25, ['cabbage', 'patta gobi', 'band gobi', 'kosu'], 'Tight, crisp green cabbage heads (approx. 700–900 g).', 15),
  each('Piece', 'cauliflower', 'Cauliflower', 'seasonal', 35, ['cauliflower', 'phool gobi', 'gobi'], 'Snow-white, compact cauliflower heads (approx. 600–800 g).', 15),
  kg('brinjal', 'Brinjal', 'seasonal', 40, ['brinjal', 'eggplant', 'baingan', 'vankaya', 'aubergine'], 'Shiny purple brinjals with soft seeds.'),
  each('Bunch', 'spinach', 'Spinach', 'leafy', 20, ['spinach', 'palak', 'palakura'], 'Fresh palak bunches, washed and trimmed.'),
  each('Bunch', 'coriander', 'Coriander', 'herbs', 15, ['coriander', 'dhaniya', 'cilantro', 'kothimeera'], 'Fragrant coriander bunches with roots on.', 30),
  each('Bunch', 'mint', 'Mint', 'herbs', 10, ['mint', 'pudina'], 'Cool, fragrant pudina bunches.'),
  kg('cucumber', 'Cucumber', 'green', 40, ['cucumber', 'kheera', 'khira', 'dosakaya'], 'Cool, crisp cucumbers with thin skin.'),
  kg('capsicum', 'Capsicum', 'green', 70, ['capsicum', 'bell pepper', 'shimla'], 'Thick-walled green capsicum with a fresh crunch.'),
  kg('okra', 'Lady Finger', 'green', 50, ['okra', 'ladies finger', 'lady finger', 'bhindi', 'bendakaya'], 'Tender bhindi, picked young so it stays crisp.'),
  kg('beetroot', 'Beetroot', 'root', 45, ['beetroot', 'beet', 'chukandar'], 'Earthy, ruby-red beetroot.'),
  each('Piece', 'bottle-gourd', 'Bottle Gourd', 'green', 30, ['bottle gourd', 'lauki', 'sorakaya', 'doodhi', 'ghiya'], 'Light green lauki (approx. 800 g – 1 kg each).', 15),
  kg('pumpkin', 'Pumpkin', 'seasonal', 35, ['pumpkin', 'kaddu', 'gummadikaya'], 'Sweet orange pumpkin, cut fresh to order.', 0.5),
  kg('garlic', 'Garlic', 'herbs', 180, ['garlic', 'lehsun', 'lahsun', 'vellulli'], 'Plump, pungent garlic bulbs with tight cloves.', 0.1, 5),
  kg('ginger', 'Ginger', 'herbs', 120, ['ginger', 'adrak', 'allam'], 'Juicy, aromatic ginger root.', 0.1, 5),
  kg('radish', 'Radish', 'root', 40, ['radish', 'mooli', 'mullangi'], 'Crisp white mooli with a gentle peppery kick.'),
  each('Piece', 'broccoli', 'Broccoli', 'green', 60, ['broccoli'], 'Deep green broccoli heads (approx. 300–400 g).', 10),
  kg('green-peas', 'Green Peas', 'green', 90, ['peas', 'matar', 'batani', 'pachi batani'], 'Sweet, plump green peas in the pod.'),
  kg('bitter-gourd', 'Bitter Gourd', 'green', 60, ['bitter gourd', 'karela', 'kakarakaya', 'pavakkai'], 'Firm, bumpy karela — great for fry and pulusu.'),
  kg('ridge-gourd', 'Ridge Gourd', 'green', 50, ['ridge gourd', 'turai', 'tori', 'beerakaya', 'peerkangai'], 'Tender ridged beerakaya for curries and chutney.'),
  kg('snake-gourd', 'Snake Gourd', 'green', 45, ['snake gourd', 'chichinda', 'potlakaya', 'pudalangai'], 'Long, tender snake gourd for kootu and poriyal.'),
  kg('drumstick', 'Drumstick', 'seasonal', 80, ['drumstick', 'moringa', 'sahjan', 'munagakaya', 'murungakkai'], 'Fleshy moringa pods — essential for sambar.'),
  kg('sweet-potato', 'Sweet Potato', 'root', 50, ['sweet potato', 'shakarkandi', 'chilagada'], 'Naturally sweet, red-skinned sweet potatoes.'),
  each('Piece', 'raw-banana', 'Raw Banana', 'seasonal', 8, ['raw banana', 'plantain', 'kacha kela', 'aratikaya', 'vazhakkai'], 'Green cooking bananas for fry and bajji.', 30),
  kg('colocasia', 'Colocasia (Arbi)', 'root', 60, ['colocasia', 'arbi', 'arvi', 'taro', 'chamadumpa', 'seppankizhangu'], 'Small, starchy arbi that turns creamy when cooked.'),
  kg('yam', 'Yam', 'root', 70, ['yam', 'suran', 'jimikand', 'kanda', 'kandagadda'], 'Earthy yam for fry, curry and chips.', 0.5),
  each('Bunch', 'curry-leaves', 'Curry Leaves', 'herbs', 10, ['curry leaves', 'kadi patta', 'karivepaku', 'karuveppilai'], 'Aromatic curry leaf sprigs for tadka.', 30),
  each('Bunch', 'fenugreek', 'Fenugreek Leaves', 'leafy', 20, ['fenugreek', 'methi', 'menthi', 'menthikura'], 'Fresh methi bunches for paratha and dal.'),
  each('Bunch', 'amaranth', 'Amaranth Leaves', 'leafy', 20, ['amaranth', 'thotakura', 'chaulai', 'keerai', 'red amaranth'], 'Tender thotakura bunches, rich in iron.'),
  each('Bunch', 'spring-onion', 'Spring Onion', 'leafy', 20, ['spring onion', 'green onion', 'scallion', 'hara pyaz'], 'Crisp spring onion bunches for fried rice and salads.'),
  kg('lemon', 'Lemon', 'herbs', 80, ['lemon', 'lime', 'nimbu', 'nimmakaya', 'elumichai'], 'Juicy lemons, priced per kg (about 20–25 pieces).', 0.25, 5),
  kg('cluster-beans', 'Cluster Beans', 'green', 60, ['cluster beans', 'guar', 'gawar', 'goru chikkudu', 'kothavarangai'], 'Tender guar beans for poriyal and dal.'),
  kg('ivy-gourd', 'Ivy Gourd (Tindora)', 'green', 50, ['ivy gourd', 'tindora', 'tendli', 'dondakaya', 'kovakkai'], 'Crunchy dondakaya for fry and pickles.'),
  kg('pointed-gourd', 'Pointed Gourd (Parwal)', 'green', 70, ['pointed gourd', 'parwal', 'potol', 'kovakkai'], 'Striped parwal for curries and stuffed fry.'),
  each('Piece', 'sweet-corn', 'Sweet Corn', 'seasonal', 25, ['sweet corn', 'corn', 'makka', 'bhutta', 'mokka jonna'], 'Juicy sweet corn cobs with husk.', 20),
  each('Pack', 'mushroom', 'Button Mushroom (200 g)', 'seasonal', 50, ['mushroom', 'button mushroom', 'kumbh'], 'Fresh white button mushrooms, 200 g pack.', 15),
  each('Piece', 'lettuce', 'Lettuce', 'leafy', 40, ['lettuce', 'salad leaves'], 'Crisp, tender lettuce heads for salads and burgers.', 10),
  kg('zucchini', 'Zucchini', 'green', 120, ['zucchini', 'courgette'], 'Tender green zucchini for grills and pasta.', 0.25, 5),
  each('Piece', 'red-cabbage', 'Red Cabbage', 'leafy', 60, ['red cabbage', 'purple cabbage'], 'Crunchy purple cabbage heads for salads and slaws.', 10),
  kg('turnip', 'Turnip', 'root', 50, ['turnip', 'shalgam', 'shalgam'], 'Mild, crisp white turnips.', 0.25, 5),
  kg('flat-beans', 'Flat Beans (Chikkudu)', 'green', 60, ['flat beans', 'broad beans', 'chikkudukaya', 'sem', 'papdi', 'avarakkai'], 'Tender flat beans for curries and poriyal.'),
  kg('raw-mango', 'Raw Mango', 'seasonal', 60, ['raw mango', 'green mango', 'kairi', 'mamidikaya', 'mangai'], 'Sour raw mangoes for pickle, pappu and chutney.', 0.5),
  each('Bunch', 'dill', 'Dill Leaves', 'herbs', 20, ['dill', 'suva', 'shepu', 'soya kura', 'sabsige'], 'Fragrant dill bunches for dal and parathas.', 15),
  kg('cherry-tomato', 'Cherry Tomato', 'seasonal', 160, ['cherry tomato'], 'Sweet, bite-sized cherry tomatoes.', 0.25, 5),
  kg('shallots', 'Small Onion (Shallots)', 'root', 80, ['shallots', 'small onion', 'sambar onion', 'chinna ullipaya', 'chinna vengayam'], 'Small pink onions for sambar and chutneys.'),
  kg('red-capsicum', 'Red Capsicum', 'green', 200, ['red capsicum', 'red bell pepper'], 'Sweet, thick-walled red bell peppers.', 0.25, 5),
  kg('yellow-capsicum', 'Yellow Capsicum', 'green', 200, ['yellow capsicum', 'yellow bell pepper'], 'Sweet, crunchy yellow bell peppers.', 0.25, 5),
];

export const catalogPhoto = (key: string) => `/images/catalog/${key}.jpg`;

export function matchTemplate(name: string): VegetableTemplate | undefined {
  const n = name.trim().toLowerCase();
  if (n.length < 3) return undefined;
  const longestFirst = (t: VegetableTemplate) => Math.max(...t.keywords.filter((k) => n.includes(k)).map((k) => k.length), 0);
  return VEGETABLE_CATALOG.map((t) => ({ t, score: longestFirst(t) })).filter((x) => x.score > 0).sort((a, b) => b.score - a.score)[0]?.t;
}
