import unittest
import numpy as np
#import mpl_resize
from mpl_resize import Bounds, mpl_resize

class TestCase(unittest.TestCase):
	def test_rescaling_horiziontal(self):
		pb_left = Bounds(0.06, 0.54, 0.39, 0.92)
		pb_right = Bounds(0.4 , 0.64, 0.55, 0.83)

		ab_left = Bounds(0.01340278, 0.49231481, 0.40375, 0.965)
		ab_right = Bounds(0.34236111, 0.59231481, 0.56375, 0.875)

		scale_factor = mpl_resize._calc_scale_factor(pb_left, pb_right, ab_left, ab_right, 'horizontal')

		pb_left_rescaled = pb_left.rescale(scale_factor)
		pb_right_scaled = pb_right.rescale(scale_factor)

		err = ab_right.x0 - (pb_left_rescaled.x1 + ab_left.x1 - pb_left.x1)
		self.assertTrue(np.abs(err) < 0.001)

	def test_rescaling_vertical(self):
		pb_bottom = Bounds(0.1, 0.1, 0.4, 0.4)
		pb_top = Bounds(0.1, 0.42, 0.4, 0.62)

		border = 0.05
		ab_bottom = Bounds(pb_bottom.x0 - border, pb_bottom.y0 - border, pb_bottom.x1 + border, pb_bottom.y1 + border)
		ab_top = Bounds(pb_top.x0 - border, pb_top.y0 - border, pb_top.x1 + border, pb_top.y1 + border)

		scale_factor = mpl_resize._calc_scale_factor(pb_bottom, pb_top, ab_bottom, ab_top, 'vertical')
		pb_bottom_rescaled = pb_bottom.rescale(scale_factor)
		pb_top_rescaled = pb_top.rescale(scale_factor)

		err = ab_top.y0 - (pb_bottom_rescaled.y1 + border)
		self.assertTrue(np.abs(err) < 0.001)

	def test_overlap_detection_vertical_overlap_vertical_align(self):
		ab_bottom = np.array([0.05340278, 0.05231481, 0.51375   , 0.545     ])
		ab_top = np.array([0.05340278, 0.37231481, 0.51375   , 0.765     ])
		self.assertTrue(mpl_resize.is_overlapping(ab_bottom, ab_top))


if __name__ == '__main__':
	unittest.main()