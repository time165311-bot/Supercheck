import coverEquipment from './images/cover_equipment_1793154890458.jpg';
import coverDrugs from './images/cover_drugs_1793154889669.jpg';
import coverBag from './images/cover_bag_1793154904362.jpg';
import coverCart from './images/cover_cart_1793154903647.jpg';

export const categoryCovers = {
  equipment: coverEquipment,
  drugs: coverDrugs,
  bag: coverBag,
  cart: coverCart,
} as const;

export type CategoryKey = keyof typeof categoryCovers;
