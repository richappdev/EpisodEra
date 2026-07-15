/** Client-side franchise ordering helpers used when rendering catalog-only views. */
import {FranchiseOrder, FranchiseTitle} from "../types/franchise";

export const sortFranchiseTitles = (titles: FranchiseTitle[], order: FranchiseOrder): FranchiseTitle[] =>
  [...titles].sort((left, right) => {
    const leftOrder = order === "release" ? left.releaseOrder : left.chronologicalOrder;
    const rightOrder = order === "release" ? right.releaseOrder : right.chronologicalOrder;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.title.localeCompare(right.title);
  });
