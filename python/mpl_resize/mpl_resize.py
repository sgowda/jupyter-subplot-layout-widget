import numpy as np
import matplotlib
import matplotlib.patches as patches
import matplotlib.pyplot as plt

class Bounds(object):
    def __init__(self, x0, y0, x1, y1):
        self.x0 = x0
        self.y0 = y0
        self.x1 = x1
        self.y1 = y1

    def size(self):
        return np.array([self.x1 - self.x0, self.y1 - self.y0])

    def rescale(self, scale, save=False):
        new_size = self.size() * scale
        x1 = self.x0 + new_size[0]
        y1 = self.y0 + new_size[1]
        return Bounds(self.x0, self.y0, x1, y1)

    def to_list(self):
        return np.array([self.x0, self.y0, self.x1, self.y1])

    def __repr__(self):
        return "Rect[(x0, y0)=(%g, %g) -> (x1, y1)=(%g, %g)]" % (self.x0, self.y0, self.x1, self.y1)

    def __str__(self):
        return self.__repr__()

def get_axis_bounds(fig, ax, scaled=False):
    children = ax.get_children()

    # initial est based on ax itself
    p0, p1 = ax.bbox.get_points()
    xmax, ymax = p1
    xmin, ymin = p0


    for child in children:
        if isinstance(child, matplotlib.axis.XAxis):
            text_obj = filter(lambda x: isinstance(x, matplotlib.text.Text), child.get_children())   ## Axis labels?
            text_obj_y = [x.get_window_extent(renderer=fig.canvas.renderer).p0[1] for x in text_obj]
            ymin_label = np.min(text_obj_y)
            if ymin_label < ymin:
                ymin = ymin_label
        elif isinstance(child, matplotlib.axis.YAxis):
            text_obj = filter(lambda x: isinstance(x, matplotlib.text.Text), child.get_children())
            text_obj_x = [x.get_window_extent(renderer=fig.canvas.renderer).p0[0] for x in text_obj]
            xmin_label = np.min(text_obj_x)
            if xmin_label < xmin:
                xmin = xmin_label
        elif hasattr(child, 'get_window_extent'):
            bb = child.get_window_extent(renderer=fig.canvas.renderer)
            if xmax < bb.p1[0]:
                xmax = bb.p1[0]
            if xmin > bb.p0[0]:
                xmin = bb.p0[0]
            if ymin > bb.p0[1]:
                ymin = bb.p0[1]
            if ymax < bb.p1[1]:
                ymax = bb.p1[1]

    # special handler for ticklabels, which don't work in the same way as above for some reason..
    for l in ax.get_xticklabels():
        bb = l.get_window_extent(renderer=fig.canvas.renderer)
        if xmax < bb.p1[0]:
            xmax = bb.p1[0]
        if xmin > bb.p0[0]:
            xmin = bb.p0[0]
        if ymin > bb.p0[1]:
            ymin = bb.p0[1]
        if ymax < bb.p1[1]:
            ymax = bb.p1[1]

    if scaled:
        rect_bounds = np.array([xmin, ymin, xmax, ymax])
        fig_size_x, fig_size_y = fig.get_size_inches() * fig.dpi
        rect_bounds /= np.array([fig_size_x, fig_size_y, fig_size_x, fig_size_y])
        return rect_bounds
    else:
        return np.array([xmin, ymin, xmax, ymax])

def frame_axis(fig, ax, color='red'):
    fig_size_x, fig_size_y = fig.get_size_inches() * fig.dpi
    x0, y0, x1, y1 = get_axis_bounds(fig, ax)
    width = x1 - x0
    height = y1 - y0

    rect = patches.Rectangle([x0, y0], width, height, linewidth=1, edgecolor=color, facecolor='none')

    fig.patches.extend([rect])

def get_plot_bounds(fig, ax):
    fig_size_x, fig_size_y = fig.get_size_inches() * fig.dpi
    plot_bounds = ax.bbox.get_points() / np.array([fig_size_x, fig_size_y])
    return plot_bounds.ravel()

def is_overlapping(bounds1, bounds2):
    xmin1, ymin1, xmax1, ymax1 = bounds1
    xmin2, ymin2, xmax2, ymax2 = bounds2
    x_overlapping_km = (xmin1 >= xmin2 and xmin1 <= xmax2) or \
        (xmax1 >= xmin2 and xmax1 <= xmax2) or \
        (xmax1 >= xmax2 and xmin1 <= xmin2) or \
        (xmax1 <= xmax2 and xmin1 >= xmin2)
    y_overlapping_km = (ymin1 >= ymin2 and ymin1 <= ymax2) or \
        (ymax1 >= ymin2 and ymax1 <= ymax2) or \
        (ymax1 >= ymax2 and ymin1 <= ymin2) or \
        (ymax1 <= ymax2 and ymin1 >= ymin2)
    return x_overlapping_km and y_overlapping_km

def detect_overlapping_axes(fig, axes, ret_full=False, verbose=False):
    axes_bounds = [get_axis_bounds(fig, ax) for ax in axes]
    plot_bounds = [get_plot_bounds(fig, ax) for ax in axes]

    if verbose:
        print("Axes bounds")
        print(axes_bounds)
        print("plot bounds")
        print(plot_bounds)

    overlapping = False
    N = len(axes)
    overlapping_mat = np.zeros([N, N], dtype=bool)

    for k, ax1 in enumerate(axes):
        xmin1, ymin1, xmax1, ymax1 = axes_bounds[k]

        for m,ax2 in enumerate(axes):
            if m <= k: continue

            overlapping_km_with_text = is_overlapping(axes_bounds[k], axes_bounds[m])
            overlapping_km_plot_only = is_overlapping(plot_bounds[k], plot_bounds[m])

            overlapping_km = overlapping_km_with_text and not overlapping_km_plot_only
            overlapping_mat[k,m] = overlapping_km
            overlapping = overlapping or overlapping_km

            if verbose:
                print("k={}, m={}, overlapping with text={}, overlapping plot only={}".format(k, m, overlapping_km_with_text, overlapping_km_plot_only))

    if ret_full:
        return overlapping_mat
    else:
        return overlapping

def calc_scale_factor_horizontal(fig, ax1, ax2):
    axes = [ax1, ax2]
    axes_bounds = [get_axis_bounds(fig, ax, scaled=True) for ax in axes]
    plot_bounds = [get_plot_bounds(fig, ax) for ax in axes]

    if plot_bounds[0][0] < plot_bounds[1][0]:
        left_idx, right_idx = 0, 1
    else:
        left_idx, right_idx = 1, 0
    return _calc_scale_factor(plot_bounds[left_idx], plot_bounds[right_idx],
        axes_bounds[left_idx], axes_bounds[right_idx], 'horizontal')

def _calc_scale_factor(pb_left, pb_right, ab_left, ab_right, axis):
    """Helper function for scaling, axis-object free calculations"""
    if not isinstance(pb_left, Bounds):
        pb_right = Bounds(*pb_right)
        pb_left = Bounds(*pb_left)
        ab_right = Bounds(*ab_right)
        ab_left = Bounds(*ab_left)

    if axis == 'horizontal':
        if pb_left.x0 == pb_right.x0:
            return 0 # there's no horizontal space between the axes (aligned vertically), so shrinking can't help

        extra_space_needed = ab_left.x1 - ab_right.x0
        scaling_dim_size = pb_left.size()[0]
    elif axis == 'vertical':
        if pb_left.y0 == pb_right.y0:
            return 0 # no vertical space between axes so you can't shrink

        extra_space_needed = ab_left.y1 - ab_right.y0
        scaling_dim_size = pb_left.size()[1]
    else:
        raise ValueError("Unrecognized axis: %s" % axis)

    # if the space needed is negative, then there is already enough so no scaling is necessary
    if extra_space_needed <= 0:
        return 1.0

    # shrink ab_left by an amount such that extra_space_needed == 0
    scale_factor = 1 - extra_space_needed / scaling_dim_size
    return scale_factor

def calc_scale_factor_vertical(fig, ax1, ax2):
    axes = [ax1, ax2]
    axes_bounds = [get_axis_bounds(fig, ax, scaled=True) for ax in axes]
    plot_bounds = [get_plot_bounds(fig, ax) for ax in axes]

    if plot_bounds[0][1] < plot_bounds[1][1]:
        idx_bottom, idx_top = 0, 1
        # reorder
        # return calc_scale_factor_vertical(fig, ax2, ax1)
    else:
        idx_bottom, idx_top = 1, 0

    return _calc_scale_factor(plot_bounds[idx_bottom], plot_bounds[idx_top],
                              axes_bounds[idx_bottom], axes_bounds[idx_top], 'vertical')
        # top_plot_label_space = plot_bounds[0][1] - axes_bounds[0][1]
        # bottom_plot_label_space = axes_bounds[1][3] - plot_bounds[1][3]
        # text_space = top_plot_label_space + bottom_plot_label_space

        # height_avail = axes_bounds[0][1] - axes_bounds[1][1]
        # if height_avail == 0:
        #     return 0 # axes are aligned in the vertical axis, so shrinking can't help you

        # plot_max_height = height_avail - text_space
        # scale_fac = plot_max_height / height_avail

        # return scale_fac

def calc_scale_factor_pairwise(fig, ax1, ax2):
    sf_h = calc_scale_factor_horizontal(fig, ax1, ax2)
    sf_v = calc_scale_factor_vertical(fig, ax1, ax2)
    return np.max([sf_h, sf_v])

def calc_scale_factor(fig, axes):
    overlapping_mat = detect_overlapping_axes(fig, axes, ret_full=True)
    inds1, inds2 = np.nonzero(overlapping_mat)

    scale_factor = np.ones(overlapping_mat.shape)

    for k in inds1:
        for m in inds2:
            scale_factor[k,m] = calc_scale_factor_pairwise(fig, axes[0], axes[1])
    print("pairwise scale factors")
    print(scale_factor)
    return np.min(scale_factor)

def rescale(fig):
    """Shrink axes until there is no overlap"""
    axes = fig.get_axes()
    scale_factor = calc_scale_factor(fig, axes)
    print("scale factor", scale_factor)

    for ax in axes:
        bbox = ax.get_position()
        x0, y0 = bbox.x0, bbox.y0
        x1, y1 = bbox.x1, bbox.y1
        width = x1 - x0
        height = y1 - y0

        ax.set_position([x0, y0, width*scale_factor, height*scale_factor])

def _rescale(ax, scale_factor, anchor_top_left=True):
    """Helper function to rescale an axis"""
    bbox = ax.get_position()
    x0, y0 = bbox.x0, bbox.y0
    x1, y1 = bbox.x1, bbox.y1
    width = x1 - x0
    height = y1 - y0

    if anchor_top_left:
        ax.set_position([x0, y0, width*scale_factor, height*scale_factor])
    else:
        ax.set_position([x0*scale_factor, y0*scale_factor, width*scale_factor, height*scale_factor])

def _extended_bounding_box(axes_bounds):
    """Calculate a box which encompasses all the input boxes"""
    x0, y0 = np.inf, np.inf
    x1, y1 = -np.inf, -np.inf
    for k in range(len(axes_bounds)):
        ab = axes_bounds[k]
        if ab[0] < x0:
            x0 = ab[0]
        if ab[1] < y0:
            y0 = ab[1]
        if ab[2] > x1:
            x1 = ab[2]
        if ab[3] > y1:
            y1 = ab[3]

    height = y1 - y0
    width = x1 - x0
    return np.array([x0, y0, x1, y1])

def calc_translation_to_top_left(axes_bounds, margin=0):
    x0, y0, _, _ = _extended_bounding_box(axes_bounds)

    # translate to reference point (lower left corner = origin)
    ref_point = np.array([margin, margin])
    transl = ref_point - np.array([x0, y0])
    return transl

def reposition(fig, margin=0.02):
    """Reposition axes of a figure to the top left"""
    axes = fig.get_axes()
    axes_bounds = [get_axis_bounds(fig, ax, scaled=True) for ax in axes]
    plot_bounds = [get_plot_bounds(fig, ax) for ax in axes]

    transl = calc_translation_to_top_left(axes_bounds, margin=margin)

    # redraw axes; apply transformation to plot boundaries because that's the input to `set_position`
    for k,ax in enumerate(axes):
        pb = plot_bounds[k]
        width, height = pb[2:] - pb[:2]
        x0, y0 = pb[:2] + transl
        ax.set_position([x0, y0, width, height])

    plt.draw()

def apply(fig, reposition_axes=True):
    """Main function to call"""
    rescale(fig)


def draw_box(fig, p0, size):
    rect = patches.Rectangle(p0, size[0] * fig.dpi, size[1] * fig.dpi, linewidth=1, edgecolor='r', facecolor='none')
    fig.patches.extend([rect])

def fig_bounding_box_rescale_factor_to_canvas(fig, margin=0.02):
    """Rescale plots to take up the entire canvas without changing their aspect ratio

    margin: in inches
    """
    axes = fig.get_axes()
    axes_bounds = [get_axis_bounds(fig, ax, scaled=True) for ax in axes]
    print('axes bounds', np.vstack(axes_bounds))

    box_relative = _extended_bounding_box(axes_bounds)
    fig_size = fig.get_size_inches() - np.array([margin, margin])
    canvas_size = np.hstack([fig_size, fig_size])
    box_in = box_relative * canvas_size

    box_size_in = box_in[2:] - box_in[:2]
    scale_factor = np.min(fig_size / box_size_in) #* 0.9 # TODO eliminate fudge factor

    for ax in axes:
        bounds = get_plot_bounds(fig, ax) * canvas_size * scale_factor
        new_size_rel = (bounds[2:] - bounds[:2]) / fig_size
        x0y0 = bounds[:2] / fig_size

        ax.set_position(np.hstack([x0y0, new_size_rel]))

    return scale_factor


def fit_to_canvas(fig):
    for k in range(3):
        reposition(fig)
        canvas_rescale_factor = fig_bounding_box_rescale_factor_to_canvas(fig)
        plt.draw()
