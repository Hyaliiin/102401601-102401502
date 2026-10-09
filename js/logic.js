(function attachShiguangLogic(global) {
  "use strict";

  const limits = { name: 50, location: 100, description: 500, contact: 80 };
  const categories = ["校园卡", "水杯", "钥匙", "雨伞", "电子设备", "书籍文具", "其他"];

  function validate(values) {
    const errors = {};
    const fields = [
      ["name", "物品名称", limits.name],
      ["category", "物品类别"],
      ["location", "地点", limits.location],
      ["eventAt", "时间"],
      ["description", "物品描述", limits.description],
      ["contact", "联系方式", limits.contact]
    ];

    fields.forEach(([key, label, maxLength]) => {
      const value = typeof values[key] === "string" ? values[key].trim() : "";
      if (!value) errors[key] = `请填写${label}`;
      else if (maxLength && value.length > maxLength) errors[key] = `${label}不能超过${maxLength}个字符`;
    });

    if (values.eventAt && Number.isNaN(new Date(values.eventAt).getTime())) errors.eventAt = "请选择有效的时间";
    if (values.category && !categories.includes(values.category)) errors.category = "请选择有效的物品类别";
    if (values.type !== "lost" && values.type !== "found") errors.type = "请选择发布寻物或发布招领";
    return { valid: Object.keys(errors).length === 0, errors };
  }

  function createItem(values, ownerId, id, publishedAt) {
    const type = values.type;
    return {
      id,
      type,
      name: values.name.trim(),
      category: values.category,
      location: values.location.trim(),
      eventAt: new Date(values.eventAt).toISOString(),
      description: values.description.trim(),
      contact: values.contact.trim(),
      status: type === "lost" ? "searching" : "pending",
      publishedAt,
      ownerId
    };
  }

  global.ShiguangLogic = Object.freeze({ validate, createItem, categories, limits });
})(window);
