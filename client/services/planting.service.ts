import api from "@/services/api";

export const analyzeSoil = (data) =>
  api.post("/planting/soil-analysis", data);

export const calculateSpacing = (data) =>
  api.post("/planting/spacing", data);

export const generateLayout = (data) =>
  api.post("/planting/layout", data);
