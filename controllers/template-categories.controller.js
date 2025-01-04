const { TemplateCategory } = require("../models");

const readAllTemplateCategories = () => TemplateCategory.find();

const readPaginatedTemplateCategories = ({ pageNumber, pageSize }) =>
  TemplateCategory.find()
    .skip((parseInt(pageNumber) - 1) * pageSize)
    .limit(pageSize);

const readTemplateCategory = ({ templateCategoryId }) =>
  TemplateCategory.find({ _id: templateCategoryId });

const searchTemplateCategoryIds = ({ searchString }) =>
  TemplateCategory.distinct("_id", { name: new RegExp(searchString, "i") });

module.exports = {
  readAllTemplateCategories,
  readPaginatedTemplateCategories,
  readTemplateCategory,
  searchTemplateCategoryIds,
};
