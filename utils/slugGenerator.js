const slugify = require('slugify');

const createSlug = title => {
  return slugify(title, {
    lower: true,
    strict: true
  });
};

module.exports = createSlug;