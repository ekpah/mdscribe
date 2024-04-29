/** @type {import('@markdoc/markdoc').Config} */

import { create } from 'zustand'

const useStore = create((set) => ({
  count: 1,
  inc: () => set((state) => ({ count: state.count + 1 })),
}))

function Counter() {
  const { count, inc } = useStore()
  return (
    <div>
      <span>{count}</span>
      <button onClick={inc}>one up</button>
    </div>
  )
}

import * as functions from "./functions";
import nodes from "./nodes";
import tags from "./tags";
import variables from "./variables";

export default {
  ...functions,
  tags,
  nodes,
  variables
  // add other stuff here
};
