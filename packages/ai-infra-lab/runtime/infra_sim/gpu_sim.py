"""One scalar index operation transfers one element in the modeled memory space."""
from collections import Counter
from operator import index

import numpy as np


def launch_2d_grid(grid_dim, block_dim, kernel_fn, *args):
    gx, gy = grid_dim
    bx, by = block_dim
    for block_y in range(gy):
        for block_x in range(gx):
            for thread_y in range(by):
                for thread_x in range(bx):
                    kernel_fn(block_x, block_y, thread_x, thread_y, *args)


class TrackedBuffer:
    def __init__(self, array, space="hbm", counts=None):
        if space not in ("hbm", "sram"):
            raise ValueError("未知存储层 / Unknown memory space")
        self._array = np.asarray(array)
        self.shape = self._array.shape
        self.space = space
        self.counts = counts if counts is not None else Counter()

    def scratch(self, shape):
        return TrackedBuffer(np.zeros(shape, dtype=self._array.dtype), "sram", self.counts)

    def _index(self, key):
        indices = tuple(index(k) for k in (key if isinstance(key, tuple) else (key,)))
        if len(indices) != len(self.shape) or any(i < 0 or i >= n for i, n in zip(indices, self.shape)):
            raise IndexError("索引超出矩阵边界 / Index outside matrix bounds")
        return indices

    def _count(self, operation):
        field = self.space + "_" + operation
        self.counts[field] += 1
        self.counts[field + "_bytes"] += self._array.itemsize

    def __getitem__(self, key):
        value = self._array[self._index(key)]
        self._count("reads")
        return value.item()

    def __setitem__(self, key, value):
        self._array[self._index(key)] = value
        self._count("writes")
