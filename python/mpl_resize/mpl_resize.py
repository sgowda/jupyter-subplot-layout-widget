import numpy as np
import matplotlib
import matplotlib.patches as patches
import matplotlib.pyplot as plt

def get_axis_bounds(fig, ax, scaled=False):
    children = ax.get_children()
    
    # initial est based on ax itself
    p0, p1 = ax.bbox.get_points()
    xmax, ymax = p1
    xmin, ymin = p0
    
    for child in children:
        if isinstance(child, matplotlib.axis.XAxis):
            text_obj = filter(lambda x: isinstance(x, matplotlib.text.Text), child.get_children())
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

    if scaled:
        rect_bounds = np.array([xmin, ymin, xmax, ymax])
        fig_size_x, fig_size_y = fig.get_size_inches() * fig.dpi
        rect_bounds /= np.array([fig_size_x, fig_size_y, fig_size_x, fig_size_y])
        return rect_bounds
    else:
        return np.array([xmin, ymin, xmax, ymax])

def frame_axis(fig, ax):
    fig_size_x, fig_size_y = fig.get_size_inches() * fig.dpi
    x0, y0, x1, y1 = get_axis_bounds(fig, ax)
    width = x1 - x0
    height = y1 - y0

    rect = patches.Rectangle([x0, y0], width, height, linewidth=1, edgecolor='r', facecolor='none')

    fig.patches.extend([rect])

def get_plot_bounds(fig, ax):
    fig_size_x, fig_size_y = fig.get_size_inches() * fig.dpi
    plot_bounds = ax.bbox.get_points() / np.array([fig_size_x, fig_size_y])
    return plot_bounds.ravel()

def is_overlapping(bounds1, bounds2):
    xmin1, ymin1, xmax1, ymax1 = bounds1
    xmin2, ymin2, xmax2, ymax2 = bounds2
    x_overlapping_km = (xmin1 >= xmin2 and xmin1 <= xmax2) or (xmax1 >= xmin2 and xmax1 <= xmax2)
    y_overlapping_km = (ymin1 >= ymin2 and ymin1 <= ymax2) or (ymax1 >= ymin2 and ymax1 <= ymax2)
    return x_overlapping_km and y_overlapping_km

def detect_overlapping_axes(fig, axes, ret_full=False):
    axes_bounds = [get_axis_bounds(fig, ax) for ax in axes]
    plot_bounds = [get_plot_bounds(fig, ax) for ax in axes]
    
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

    if ret_full:
        return overlapping_mat
    else:
        return overlapping

def calc_scale_factor_horizontal(fig, ax1, ax2):
    axes = [ax1, ax2]
    axes_bounds = [get_axis_bounds(fig, ax, scaled=True) for ax in axes]
    plot_bounds = [get_plot_bounds(fig, ax) for ax in axes]
    
    if plot_bounds[0][0] < plot_bounds[1][0]:  # ax2 should be the one that gets resized
        # reorder
        return calc_scale_factor_horizontal(fig, ax2, ax1)
    else:
        right_plot_label_space = plot_bounds[0][0] - axes_bounds[0][0]
        left_plot_label_space = axes_bounds[1][2] - plot_bounds[1][2]
        text_space = right_plot_label_space + left_plot_label_space
        
        width_avail = np.abs(plot_bounds[1][0] - axes_bounds[0][0]) # y-axis area on the left plot doesn't count
        if width_avail == 0:
            return 0 # axes are aligned in the horizontal axis, so shrinking can't help you
        
        return (width_avail - text_space) / width_avail

def calc_scale_factor_vertical(fig, ax1, ax2):
    axes = [ax1, ax2]
    axes_bounds = [get_axis_bounds(fig, ax, scaled=True) for ax in axes]
    plot_bounds = [get_plot_bounds(fig, ax) for ax in axes]
    
    if plot_bounds[0][1] < plot_bounds[1][1]: 
        # reorder
        return calc_scale_factor_vertical(fig, ax2, ax1)
    else:
        top_plot_label_space = plot_bounds[0][1] - axes_bounds[0][1]
        bottom_plot_label_space = axes_bounds[1][3] - plot_bounds[1][3]
        text_space = top_plot_label_space + bottom_plot_label_space

        height_avail = axes_bounds[0][1] - axes_bounds[1][1]
        if height_avail == 0:
            return 0 # axes are aligned in the vertical axis, so shrinking can't help you        

        plot_max_height = height_avail - text_space
        scale_fac = plot_max_height / height_avail

        return scale_fac
    
def calc_scale_factor_pairwise(fig, ax1, ax2):
    sf_h = calc_scale_factor_horizontal(fig, ax1, ax2)
    sf_v = calc_scale_factor_vertical(fig, ax1, ax2)
    return np.max([sf_h, sf_v])

def calc_scale_factor(fig, axes):
    axes_bounds = [get_axis_bounds(fig, ax, scaled=True) for ax in axes]
    plot_bounds = [get_plot_bounds(fig, ax) for ax in axes]

    overlapping_mat = detect_overlapping_axes(fig, axes, ret_full=True)
    inds1, inds2 = np.nonzero(overlapping_mat)

    scale_factor = np.ones(overlapping_mat.shape)

    for k in inds1:
        for m in inds2:
            scale_factor[k,m] = calc_scale_factor_pairwise(fig, axes[0], axes[1])
    return np.min(scale_factor)

def calc_translation_to_top_left(axes_bounds, plot_bounds):
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

    # determine translation to top left
    # (x0, y0) + ____ = 
    x0_opt, y0_opt = 0, 1 - height
    transl = np.array([x0_opt, y0_opt]) - np.array([x0, y0])
    print(transl)
    return transl 

def reposition(fig):
    """Reposition axes of a figure to the top left"""
    axes = fig.get_axes()
    axes_bounds = [get_axis_bounds(fig, ax, scaled=True) for ax in axes]
    plot_bounds = [get_plot_bounds(fig, ax) for ax in axes]

    transl = calc_translation_to_top_left(axes_bounds, plot_bounds)

    # redraw axes
    for k,ax in enumerate(axes):
        pb = plot_bounds[k]
        width, height = pb[2:] - pb[:2]
        x0, y0 = pb[:2] + transl
        ax.set_position([x0, y0, width, height])
    
    plt.draw()
