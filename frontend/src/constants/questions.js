// The seven site questions and their answer options.
// `id` is what the app stores, `label` is what users see, and `value` is what the backend's
// POST /api/recommend expects (see docs/BACKEND_API.md). Two options may share a value
// (e.g. Flowers and Hedge are both "ornamental" for the model).

export const SALT_SIGNS = [
  { key: 'crust', label: 'White crust on the soil?' },
  { key: 'borewell', label: 'Salty borewell water?' },
  { key: 'burnt', label: 'Burnt leaf edges nearby?' },
  { key: 'sea', label: 'Within 2 km of the sea?' },
];

export const CHOICE_QUESTIONS = [
  {
    key: 'water_days',
    number: 2,
    title: 'Days you can water each week',
    required: true,
    options: [1, 2, 3, 5, 7].map((d) => ({ id: String(d), label: String(d), value: d })),
  },
  {
    key: 'space',
    number: 3,
    title: 'Space available',
    required: true,
    options: [
      { id: 'pot_balcony', label: 'Pot / balcony', value: 'small' },
      { id: 'small_yard', label: 'Small yard', value: 'medium' },
      { id: 'large_land', label: 'Large open land', value: 'large' },
    ],
  },
  {
    key: 'care',
    number: 4,
    title: 'Care you can give',
    required: true,
    options: [
      { id: 'low', label: 'Low', value: 'rarely' },
      { id: 'medium', label: 'Medium', value: 'few_times_week' },
      { id: 'high', label: 'High', value: 'daily' },
    ],
  },
  {
    key: 'purpose',
    number: 5,
    title: 'Main purpose',
    required: true,
    options: [
      { id: 'shade', label: 'Shade', value: 'shade' },
      { id: 'flowers', label: 'Flowers', value: 'ornamental' },
      { id: 'fruit', label: 'Fruit', value: 'fruit' },
      { id: 'hedge', label: 'Hedge', value: 'ornamental' },
      { id: 'greenery', label: 'Greenery', value: 'carbon' },
    ],
  },
  {
    key: 'children_or_animals',
    number: 6,
    title: 'Children or animals use the site?',
    required: true,
    options: [
      { id: 'yes', label: 'Yes', value: 1 },
      { id: 'no', label: 'No', value: 0 },
    ],
  },
  {
    key: 'budget',
    number: 7,
    title: 'Budget per plant',
    required: false,
    options: [
      { id: 'under_500', label: 'Under Rs 500', value: 'under_500' },
      { id: '500_2000', label: 'Rs 500–2,000', value: '500_2000' },
      { id: 'any', label: 'Any', value: 'any' },
    ],
  },
];

/** The backend value for a stored answer id. */
export function answerValue(questionKey, optionId) {
  const q = CHOICE_QUESTIONS.find((x) => x.key === questionKey);
  return q?.options.find((o) => o.id === optionId)?.value;
}

/** Filter chips on the results page; keys match the plant view model's `traits` (see services/recommendationMapper.js). */
export const RESULT_FILTERS = [
  { key: 'native', label: 'Native' },
  { key: 'low_water', label: 'Low water' },
  { key: 'low_care', label: 'Low care' },
  { key: 'shade', label: 'Shade' },
  { key: 'fruit', label: 'Fruit' },
  { key: 'flowers', label: 'Flowers' },
];

export const CHAT_SUGGESTIONS = ['Best time to plant?', 'Fertiliser?', 'Pests'];
