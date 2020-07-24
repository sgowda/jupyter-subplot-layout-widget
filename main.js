define([
  'base/js/namespace',
  'base/js/events'
], function(Jupyter, events) {

  /**
   * Retrieve the coordinates of the given event relative to the center
   * of the widget.
   *
   * @param event
   *   A mouse-related DOM event.
   * @param reference
   *   A DOM element whose position we want to transform the mouse coordinates to.
   * @return
   *    A hash containing keys 'x' and 'y'.
   */
  function getRelativeCoordinates(event, reference) {
    var x, y;
    event = event || window.event;
    var el = event.target || event.srcElement;

    if (!window.opera && typeof event.offsetX != 'undefined') {
      // Use offset coordinates and find common offsetParent
      var pos = {
        x: event.offsetX,
        y: event.offsetY
      };

      // Send the coordinates upwards through the offsetParent chain.
      var e = el;
      while (e) {
        e.mouseX = pos.x;
        e.mouseY = pos.y;
        pos.x += e.offsetLeft;
        pos.y += e.offsetTop;
        e = e.offsetParent;
      }

      // Look for the coordinates starting from the reference element.
      var e = reference;
      var offset = {
        x: 0,
        y: 0
      }
      while (e) {
        if (typeof e.mouseX != 'undefined') {
          x = e.mouseX - offset.x;
          y = e.mouseY - offset.y;
          break;
        }
        offset.x += e.offsetLeft;
        offset.y += e.offsetTop;
        e = e.offsetParent;
      }

      // Reset stored coordinates
      e = el;
      while (e) {
        e.mouseX = undefined;
        e.mouseY = undefined;
        e = e.offsetParent;
      }
    } else {
      // Use absolute coordinates
      var pos = getAbsolutePosition(reference);
      x = event.pageX - pos.x;
      y = event.pageY - pos.y;
    }
    // Subtract distance to middle
    return {
      x: x,
      y: y
    };
  }

  var dpi = 80;
  var unselected_color = "#A0A0A0";
  var selected_color = "#FF0000";

  var figure_state = {canvas_width: 8, canvas_height: 6, letter_font_size: 16, subplots: []};
  var prev_state = {};

  var state_history = []; // for implementing the undo action via ctrl-Z


  var start_x = -1;
  var start_y = -1;
  var end_x = -1;
  var end_y = -1;
  

  // volatile state, to be reset on startup
  var state = "none";
  var clicked_subplot = -1;
  var clicked_corner = [-1, -1];
  var clicked_edge = "none";
  var clicked_subplot_area = 1e9;

  var idx_to_align = -1;
  var idx_align_ref = -1;
  var align_edge = "left";
  var idx_to_copy = -1;

  var current_letter = 'A';
  var key_state_changed = false;

  function mousedown_callback(event) {
    console.log("mousedown");
    let elem = document.getElementById('canv2');
    let rect = elem.getBoundingClientRect();

    let context = elem.getContext('2d');

    let states = ["none", "new", "move", "resize", "align"];


    let rel_loc = getRelativeCoordinates(event, elem);
    start_x = rel_loc.x;
    start_y = rel_loc.y;

    if (state == "copy") {
      save_state_history();

      // make object copy
      let subplot = figure_state.subplots[idx_to_copy];
      let new_subplot = create_new_subplot(start_x, start_y, subplot.width, subplot.height);
      figure_state.subplots.push(new_subplot);

      // reset state
      $("#canvas_ui_command").text("");
      idx_to_copy = -1;
      state = "none";

      // draw
      return;
    }

    var margin = 10;
    for (i = 0; i < figure_state.subplots.length; i += 1) {
      let subplot = figure_state.subplots[i];
      let x_bounds = [subplot.left, subplot.left + subplot.width];
      let y_bounds = [subplot.top, subplot.top + subplot.height];
      let subplot_area = (y_bounds[1] - y_bounds[0]) * (x_bounds[1] - x_bounds[0]);
      if (start_x > x_bounds[0] && start_x < x_bounds[1] && start_y > y_bounds[0] && start_y < y_bounds[1] && subplot_area < clicked_subplot_area) {
        clicked_subplot = i;

        // determine if a corner was clicked
        if (Math.abs(start_x - x_bounds[0]) < margin && Math.abs(start_y - y_bounds[0]) < margin) {
          clicked_corner = [0, 0];
        } else if (Math.abs(start_x - x_bounds[1]) < margin && Math.abs(start_y - y_bounds[0]) < margin) {
          clicked_corner = [1, 0];
        } else if (Math.abs(start_x - x_bounds[0]) < margin && Math.abs(start_y - y_bounds[1]) < margin) {
          clicked_corner = [0, 1];
        } else if (Math.abs(start_x - x_bounds[1]) < margin && Math.abs(start_y - y_bounds[1]) < margin) {
          clicked_corner = [1, 1];
        } else {
          clicked_corner = [-1, -1];
        }

        // determine if an edge was clicked
        if (clicked_corner[0] == -1) {  // can't click a corner and edge at the same time
          if (Math.abs(start_x - x_bounds[0]) < margin && start_y > y_bounds[0] && start_y < y_bounds[1]) {
            clicked_edge = "x0";
          } else if (Math.abs(start_x - x_bounds[1]) < margin && start_y > y_bounds[0] && start_y < y_bounds[1]) {
            clicked_edge = "x1";
          } else if (Math.abs(start_y - y_bounds[0]) < margin && start_x > x_bounds[0] && start_x < x_bounds[1]) {
            clicked_edge = "y0";
          } else if (Math.abs(start_y - y_bounds[1]) < margin && start_x > x_bounds[0] && start_x < x_bounds[1]) {
            clicked_edge = "y1";
          } 
        }
      }
    }

    let corner_was_clicked = clicked_corner[0] != -1 && clicked_corner[1] != -1;
    let edge_was_clicked = clicked_edge != "none";
    if (clicked_subplot >= 0) {
      if (state == "align") {
        save_state_history();
        idx_align_ref = clicked_subplot;

        let subplot_to_align = figure_state.subplots[idx_to_align];
        let ref_subplot = figure_state.subplots[idx_align_ref];

        if (align_edge == "left") {
          subplot_to_align.left = ref_subplot.left;  
        } else if (align_edge == "top") {
          subplot_to_align.top = ref_subplot.top;
        } else if (align_edge == "right") {
          let curr_right = subplot_to_align.left + subplot_to_align.width;
          let displ = (ref_subplot.left + ref_subplot.width) - curr_right;
          subplot_to_align.left += displ;
        } else if (align_edge == "bottom") {
          let curr_bottom = subplot_to_align.top + subplot_to_align.height;
          let displ = (ref_subplot.top + ref_subplot.height) - curr_bottom;
          subplot_to_align.top += displ;
        } else if (align_edge == "horizontal center") {
          let curr_ctr = subplot_to_align.left + subplot_to_align.width/2;
          let displ = (ref_subplot.left + ref_subplot.width/2) - curr_ctr;
          subplot_to_align.left += displ;
        } else if (align_edge == "vertical center") {
          let curr_ctr = subplot_to_align.top + subplot_to_align.height/2;
          let displ = (ref_subplot.top + ref_subplot.height/2) - curr_ctr;
          subplot_to_align.top += displ;
        } else {
          console.log("Unrecognized align edge: ", align_edge);
        }

        // reset state
        idx_to_align = -1;
        idx_align_ref = -1;
        subplot_to_align.selected = false;
        ref_subplot.selected = false;
        $("#canvas_ui_command").text("");
      } else if (corner_was_clicked || edge_was_clicked) {
        state = "resize";
      } else {
        state = "move";
      }
    } else {
      state = "new";
    }

    draw();
  }

  function unselect(subplot) {
    console.log("unselect subplot " + subplot.letter);
    subplot.color = unselected_color;
    subplot.selected = false;

    $("#edit_selected_subplot").hide();
  }

  function select(subplot) {
    console.log("Selecting subplot ", subplot.letter);
    subplot.color = selected_color;
    subplot.selected = true; // toggle selection

    $("#edit_selected_subplot").show();
    $("#subplot_letter_input").val(subplot.letter);
  }

  function save_state_history() {
    let state_copy = JSON.parse(JSON.stringify(figure_state));
    state_history.push(state_copy);
    console.log("Saved state. Length = ", state_history.length);
  }

  function mouseup_callback(event) {
    let elem = document.getElementById('canv2');
    let rect = elem.getBoundingClientRect();

    let context = elem.getContext('2d');
    let states = ["none", "new", "move", "resize"];

    let rel_loc = getRelativeCoordinates(event, elem);
    end_x = rel_loc.x;
    end_y = rel_loc.y;


    if (state == "new") {
      let width = Math.abs(start_x - end_x);
      let height = Math.abs(start_y - end_y);

      if (width < 15 || height < 15) {
        // clear selection,i.e. you can't make a tiny subplot
        for (let i = 0; i < figure_state.subplots.length; i += 1) {
          unselect(figure_state.subplots[i]);
        }
      } else {
        save_state_history();

        let subplot = create_new_subplot(Math.min(start_x, end_x), Math.min(start_y, end_y),
          width, height);
        figure_state.subplots.push(subplot);

        select(subplot);

        // increment letter for next plot
        current_letter = String.fromCharCode(current_letter.charCodeAt(0) + 1);
      }
    } else if (state == "move") {
      displ_x = Math.abs(end_x - start_x);
      displ_y = Math.abs(end_y - start_y);

      var subplot = figure_state.subplots[clicked_subplot];
      if (displ_x < 5 && displ_y < 5) {
        select(subplot);
      } else {
        save_state_history();

        // move action
        subplot.left += end_x - start_x;
        subplot.top += end_y - start_y;
      }

      // select for future actions
      select(subplot);
    } else if (state == "resize") {
      var subplot = figure_state.subplots[clicked_subplot];
      let x_bounds = [subplot.left, subplot.left + subplot.width];
      let y_bounds = [subplot.top, subplot.top + subplot.height];

      let corner_was_clicked = clicked_corner[0] != -1 && clicked_corner[1] != -1;
      let edge_was_clicked = clicked_edge != "none";

      save_state_history();

      if (corner_was_clicked) {
        let corner_displ_x = x_bounds[clicked_corner[0]] - end_x;
        let corner_displ_y = y_bounds[clicked_corner[1]] - end_y;

        if (clicked_corner[0] == 0 && clicked_corner[1] == 0) {
          // top left corner
          subplot.width += corner_displ_x;
          subplot.height += corner_displ_y;

          subplot.left = end_x;
          subplot.top = end_y;
        } else if (clicked_corner[0] == 1 && clicked_corner[1] == 0) {
          // top right corner
          subplot.width -= corner_displ_x;
          subplot.height += corner_displ_y;

          subplot.top = end_y;
        } else if (clicked_corner[0] == 0 && clicked_corner[1] == 1) {
          // bottom left corner
          subplot.width += corner_displ_x;
          subplot.height -= corner_displ_y;

          subplot.left = end_x;
        } else if (clicked_corner[0] == 1 && clicked_corner[1] == 1) {
          // bottom right corner
          subplot.width -= corner_displ_x;
          subplot.height -= corner_displ_y;
        }
      } else if (edge_was_clicked) {
        if (clicked_edge == "x0") {
          // left edge
          let x_displ = x_bounds[0] - end_x;
          subplot.left = end_x;
          subplot.width += x_displ;
        } else if (clicked_edge == "x1") {
          // right edge
          let x_displ = end_x - x_bounds[1];
          subplot.width += x_displ;          
        } else if (clicked_edge == "y0") {
          console.log("top edge")
          // top(?) edge
          let y_displ = y_bounds[0] - end_y;
          subplot.top = end_y;
          subplot.height += y_displ;
        } else if (clicked_edge == "y1") {
          console.log("bottom edge");
          // bottom(?) edge
          let y_displ = y_bounds[1] - end_y;
          subplot.height -= y_displ;
        }
      }

      // select for future actions
      select(subplot);
    } else if (state == "none") {
      // pass
    }

    clicked_subplot = -1;
    clicked_corner = [-1, -1];
    clicked_edge = "none";
    clicked_subplot_area = 1e9;
    state = "none"

    draw();
  }

  function draw() {
    let elem = document.getElementById('canv2');

    // resize the canvas
    elem.width = figure_state.canvas_width * dpi;
    elem.height = figure_state.canvas_height * dpi;

    let rect = elem.getBoundingClientRect();

    let context = elem.getContext('2d');    
    context.clearRect(0, 0, elem.width, elem.height);
    context.beginPath();

    for (let index = 0; index < figure_state.subplots.length; index++) {
      var subplot = figure_state.subplots[index];

      // draw object
      context.strokeStyle = subplot.color;
      context.strokeRect(subplot.left, subplot.top, subplot.width, subplot.height);

      context.textAlign = "left";
      context.font = "16px Arial";
      context.fillText(subplot.letter, subplot.left, subplot.top);

      context.textAlign = "center";
      context.font = "10px Arial";
      context.fillText(subplot.annotation, subplot.left + subplot.width/2, subplot.top + subplot.height/2);
    }

    // save state into current cell
    save();
  }

  function generate_code() {
    str = "import matplotlib.pyplot as plt\n%matplotlib notebook\n";
    str += `fig = plt.figure(figsize=(${figure_state.canvas_width}, ${figure_state.canvas_height}))\n`;

    let canvas_width_px = figure_state.canvas_width * dpi;
    let canvas_height_px = figure_state.canvas_height * dpi;

    str += "axes_data = [ # (name of axis, label, rectangle dim.)\n";

    for (i = 0; i < figure_state.subplots.length; i += 1) {
      subplot = figure_state.subplots[i];

      let py_width = subplot.width / canvas_width_px;
      let py_height = subplot.height / canvas_height_px;
      let py_x0 = subplot.left / canvas_width_px;
      let py_y0 = 1 - (subplot.top / canvas_height_px) - py_height;

      let subplot_letter = subplot.letter;
      if (subplot_letter.length == 0) {
        subplot_letter += i;
      }
      str += `    ("${subplot_letter}", '${subplot.letter}', [${py_x0.toFixed(2)}, ${py_y0.toFixed(2)}, ${py_width.toFixed(2)}, ${py_height.toFixed(2)}]),\n`;

      // str += `ax${subplot_letter} = fig.add_axes([${py_x0.toFixed(2)}, ${py_y0.toFixed(2)}, ${py_width.toFixed(2)}, ${py_height.toFixed(2)}])\n`;
      // str += `fig.text(${py_x0.toFixed(2)}, ${(py_y0 + py_height).toFixed(2)}, "${subplot.letter}", fontsize=${figure_state.letter_font_size}, va='bottom', ha='right')\n`
    }
    str += "]\n";
    str += `axes = []
for ax_idx, ltr, rect in axes_data:
    ax = fig.add_axes(rect)
    ax.set_title(ltr, loc='left', fontsize=${figure_state.letter_font_size})
    axes.append(ax)
`

    // inject new cell into the notebook
    Jupyter.notebook.insert_cell_below('code').set_text(str);
  }

  function clear() {
    save_state_history();
    figure_state.subplots = [];
    draw();
  }

  function save() {
    var curr_cell = Jupyter.notebook.get_selected_cell();
    curr_cell.set_text("# Use the canvas below to lay out your plot\n# JSON data (manual editing is discouraged!):\n# " + JSON.stringify(figure_state));
  }

  function input_field_focus() {
    // disable Jupyter notebook keyboard shortcuts which prevent typing into the field
    Jupyter.keyboard_manager.disable();
  }

  function input_field_blur() {
    // re-enable keyboard shortcuts
    Jupyter.keyboard_manager.enable();
  }

  function create_new_subplot(left, top, width, height) {
    return {
      color: unselected_color,
      width: width,
      height: height,
      top: top,
      left: left,
      letter: current_letter,
      selected: false,
      annotation: "a subplot"
    };
  }

  function split_subplot() {
    let horiz_splits = parseInt($("#horiz_splits_input").val());
    let vertical_splits = parseInt($("#vertical_splits_input").val());
    let idx = -1;
    // console.log("splitting into " + horiz_splits + " by" + vertical_splits);
    if (isNaN(horiz_splits)) {
      horiz_splits = 1;
    }
    if (isNaN(vertical_splits)) {
      vertical_splits = 1;
    }

    save_state_history();

    for (let i = 0; i < figure_state.subplots.length; i += 1) {
      if (figure_state.subplots[i].selected) {
        let subplot = figure_state.subplots[i];
        let x_bounds = [subplot.left, subplot.left + subplot.width];
        let y_bounds = [subplot.top, subplot.top + subplot.height];

        let n_horiz_lines = parseInt($("#vert_split_spacing").val())
        let n_vertical_lines = parseInt($("#horiz_split_spacing").val())
        let vertical_spacing = n_horiz_lines * 1.0/6 * dpi // 1/6 inches per line
        let horiz_spacing = n_vertical_lines * 1.0/6 * dpi // 1/6 inches per line

        let new_width = (x_bounds[1] - x_bounds[0] - horiz_spacing*(horiz_splits - 1)) / horiz_splits;
        let new_height = (y_bounds[1] - y_bounds[0] - vertical_spacing*(vertical_splits - 1)) / vertical_splits;        

        console.log(new_width, x_bounds[1] - x_bounds[0], horiz_splits)

        for (let kx = 0; kx < horiz_splits; kx += 1) {
          for (let ky = 0; ky < vertical_splits; ky += 1) {
            let new_subplot = create_new_subplot(x_bounds[0] + (new_width + horiz_spacing)*kx, 
              y_bounds[0] + (new_height + horiz_spacing)*ky, new_width, new_height);
            figure_state.subplots.push(new_subplot);            
            current_letter = String.fromCharCode(current_letter.charCodeAt(0) + 1);
          }
        }

        idx = i;
        break;
      }
    }    

    // remove the old subplot
    if (idx >= 0) {
      figure_state.subplots.splice(idx, 1);
    }

    draw();
  }

  function update_subplot_letter() {
    let new_letter = $("#subplot_letter_input").val();
    for (let i = 0; i < figure_state.subplots.length; i += 1) {
      if (figure_state.subplots[i].selected) {
        figure_state.subplots[i].letter = new_letter;
      }
    }
    draw();
  }

  // keydown handler
  document.addEventListener("keydown", event => {
    if (event.keyCode == 90 && event.ctrlKey) {
      if (state_history.length > 0) {
        figure_state = state_history.pop();
        console.log("ctrl + z, state_history.length: ", state_history.length);
        draw();
      }
    }

    selected_subplots = [];
    for (let i = 0; i < figure_state.subplots.length; i += 1) {
      if (figure_state.subplots[i].selected) {
        selected_subplots.push(i);
      }
    }

    // arrow keys
    let displ = 5;
    if (selected_subplots.length > 0 && (event.keyCode >= 37 && event.keyCode <= 40)) {
      if (!key_state_changed) {
        save_state_history();
      }

      if (event.keyCode == 37) { // left arrow
        console.log("move left");
        for (let i = 0; i < selected_subplots.length; i += 1) {
          let idx = selected_subplots[i];
          figure_state.subplots[idx].left -= displ;
        }
        key_state_changed = true;
      } else if (event.keyCode == 39) { // right arrow
        console.log("move right");
        for (let i = 0; i < selected_subplots.length; i += 1) {
          let idx = selected_subplots[i];
          figure_state.subplots[idx].left += displ;
        }
        key_state_changed = true;
      } else if (event.keyCode == 38) { // up arrow
        console.log("move up");
        for (let i = 0; i < selected_subplots.length; i += 1) {
          let idx = selected_subplots[i];
          figure_state.subplots[idx].top -= displ;
        }
        key_state_changed = true;
      } else if (event.keyCode == 40) { // down arrow
        console.log("move down");
        for (let i = 0; i < selected_subplots.length; i += 1) {
          let idx = selected_subplots[i];
          figure_state.subplots[idx].top += displ;
        }
        key_state_changed = true;
      }      
    }


    if (event.keyCode == 67 && selected_subplots.length == 1) { // ctrl+c
      console.log("copy")
      idx_to_copy = selected_subplots[0];
      $("#canvas_ui_command").text("Click where you want the copied subplot")
      // copy will occur on the next mousedown
      state = "copy";
    }

    if (event.keyCode == 68) { // ctrl + d=> delete
      if (!key_state_changed) {
        save_state_history();
      }
      console.log("delete")
      figure_state.subplots = figure_state.subplots.filter(x => !x.selected);
      key_state_changed = true;
    }

    // only redraw if something moved
    if (selected_subplots.length > 0) {
      console.log('redrawing');
      draw();  
    }
    
  });

  document.addEventListener("keyup", event => {
    if (key_state_changed) {
      key_state_changed = false;
    }
  })


  function update_figure_canvas() {
    figure_state.canvas_width = parseInt($("#canvas_width_input").val());
    figure_state.canvas_height = parseInt($("#canvas_height_input").val());
    console.log("updating figure state: ", figure_state);
    draw();
  }

  function align_callback() {
    let n_selected = 0;
    let selected_idx = -1;
    for (let i = 0; i < figure_state.subplots.length; i += 1) {
      if (figure_state.subplots[i].selected) {
        n_selected += 1;
        selected_idx = i;
      }
    }

    if (n_selected == 1) {
      idx_to_align = selected_idx;
      state = "align";
      align_edge = $("#align_point").val();

      $("#canvas_ui_command").text("Select reference subplot for alignment");
    }
  }

  function id_to_jquery(parent_id) {
    if (!parent_id.startsWith("#")) {
      return "#" + parent_id;
    } else {
      return parent_id;
    }
  }

  function make_input_and_label(label, id, parent_id, input_attrs) {
    parent_id = id_to_jquery(parent_id);
    let label_obj = $("<label>").text(label).appendTo(parent_id);

    input_attrs.id = id;
    let input = $("<input>").attr(input_attrs).appendTo(parent_id);
    return {'label': label_obj, 'input': input};
  }

  function make_selector_and_label(label, id, parent_id, input_options) {
    parent_id = id_to_jquery(parent_id);
    let label_obj = $("<label>").text(label).appendTo(parent_id);

    let input = $("<select>").attr({'id': id}).appendTo(parent_id);
    $(input_options).each(function() {
      input.append($("<option>").attr('value', this.val).text(this.text));
    })
    return {'label': label_obj, 'input': input};
  }

  var add_cell = function() {
    figure_state.subplots = [];

    var curr_cell = Jupyter.notebook.get_selected_cell();
    var curr_text = curr_cell.get_text();

    if (curr_text.includes("# JSON data")) {
      console.log("grabbing state from cell");
      let curr_text_lines = curr_text.split("\n");
      figure_state = JSON.parse(curr_text_lines[curr_text_lines.length - 1].substring(2));
      console.log(figure_state);

      for (let i = 0; i < figure_state.subplots.length; i += 1) {
        unselect(figure_state.subplots[i]);
      }
    } else {
      curr_cell.set_text(`# Select your plot below`);
      current_letter = 'A';
    }

    Jupyter.notebook.select();
    Jupyter.notebook.execute_cell();

    // # get reference to the stuff 
    // Jupyter.notebook.select();
    var output_subarea = $("#notebook-container")
      .children('.selected')
      .children('.output_wrapper')
      .children('.output');

    // add to DOM
    let div = document.createElement("div");
    output_subarea[0].appendChild(div);     

    // sub-element divs 
    let div_fig = document.createElement("div");
    div_fig.setAttribute("id", "div_fig");
    div.appendChild(div_fig);
    
    // figure-level HTML elements
    $("<label>").text("Keyboard shortcuts: Undo (ctrl+z), Copy (ctrl+c)").appendTo("#div_fig");
    $("<br>").appendTo("#div_fig");
    var generate_button = document.createElement("BUTTON");
    generate_button.innerHTML = "Generate python cell"
    generate_button.addEventListener("click", generate_code, false);

    let clear_button = document.createElement("button");
    clear_button.innerHTML = "Clear";
    clear_button.addEventListener("click", clear, false);

    let letter_font_size = $("<label>").text("Letter font size: ");
    letter_font_size.append($("<input>").attr({'id': 'letter_font_size', 'value':16, 'size': 5}));

    div_fig.appendChild(generate_button);
    div_fig.appendChild(document.createElement("br"));
    div_fig.appendChild(clear_button);
    
    $("#div_fig").append(letter_font_size);

    make_input_and_label("Canvas width: ", "canvas_width_input", "div_fig", {"size": 5, "title": "width in inches. Common sizes:\n- matplotlib default: 8 in\n- Powerpoint: 13.33 in\n- IEEE single column: 3.5 in\n- IEEE double column: 7.16 in"});
    $("#canvas_width_input").val(figure_state.canvas_width);

    make_input_and_label("Canvas height: ", "canvas_height_input", "div_fig", {"size": 5, "title": "height in inches"});
    $("#canvas_height_input").val(figure_state.canvas_height);

    let canvas_update_btn = $("<button>")
      .attr({"id": "canvas_update_btn"}).html("Update canvas")
      .appendTo("#div_fig")
      .click(update_figure_canvas);

    $("<br>").appendTo("#div_fig");
    let canvas_ui_command = $("<label>").attr({"id": "canvas_ui_command"}).text("")
      .appendTo("#div_fig");

    // create canvas
    let canvas_width_px = figure_state.canvas_width * dpi;
    let canvas_height_px = figure_state.canvas_height * dpi;
    var canvas = document.createElement("canvas");
    div.appendChild(canvas);
    canvas.setAttribute("id", "canv2");
    canvas.setAttribute("style", "border:1px solid #000000;"); //  margin-left:150px
    canvas.setAttribute("width", canvas_width_px);
    canvas.setAttribute("clientWidth", canvas_width_px);
    canvas.setAttribute("height", canvas_height_px);    


    // HTML elements once you select subplot(s)
    // Labels
    let div_selected = document.createElement("div");
    div_selected.setAttribute("id", "edit_selected_subplot");
    div.appendChild(div_selected);    

    let div_selected_table = $("<table>").attr({"id": "subplot_selected_table", "style": "padding: 15px"}).appendTo("#edit_selected_subplot");

    let label_row = $("#subplot_selected_table").append("<tr>").children("tr:last").append("<td>Label</td>").append("<td id=label_row style='padding-left: 10px'>");
    let split_row = $("#subplot_selected_table").append("<tr>").children("tr:last").append("<td>Split</td>").append("<td id=split_row style='padding-left: 10px'>");
    let align_row = $("#subplot_selected_table").append("<tr>").children("tr:last").append("<td>Align</td>").append("<td id=align_row style='padding-left: 10px'>");
    let copy_row = $("#subplot_selected_table").append("<tr>").children("tr:last").append("<td>Copy</td>").append("<td id=copy_row style='padding-left: 10px'>Press ctrl+c</td>");

    // labels
    let axis_letter = make_input_and_label("Axis letter", "subplot_letter_input", "label_row", {"size": "5"});

    // Splitting
    let v_splits = make_input_and_label("No. of row splits", "vertical_splits_input", "split_row", {"size": "2.5"});
    let h_splits = make_input_and_label("No. of col. splits", "horiz_splits_input", "split_row", {"size": "2.5"});

    let v_spacing = make_input_and_label("Vert. spacing", "vert_split_spacing", "split_row", 
      {"size": "2.5", "title": "Vertical spacing, in units of in text lines"});
    v_spacing.input.val(3);
    let h_spacing = make_input_and_label("Horiz. spacing", "horiz_split_spacing", "split_row", 
      {"size": "2.5", "title": "Horizontal spacing, in units of in text lines"});
    h_spacing.input.val(3);

    $("<button>").html("Split").click(split_subplot).appendTo("#split_row");

    // Alignment
    let alignment_selector = $("<select>").attr({'id': "align_point"}).appendTo("#align_row");
    let alignment_options = ["left", "right", "top", "bottom", "horizontal center", "vertical center"];
    $(alignment_options).each(function() {
      alignment_selector.append($("<option>").attr('value', this).text(this));
    })

    let align_btn = $("<button>")
      .attr({"id": "align_left"}).html("Align")
      .appendTo("#align_row");
    align_btn.click(align_callback);
    

    // set HTML attributes. do this *after* you've added new elements to the doc
    div.setAttribute("style", "margin-left:150px;");

    // start elements as hidden if they are related to selecting a subplot
    $("#edit_selected_subplot").hide();

    var elem = document.getElementById('canv2');
    console.log(elem)
    elem.width = canvas_width_px;
    elem.height = canvas_height_px;

    elem.addEventListener('mousedown', mousedown_callback, false);
    elem.addEventListener('mouseup', mouseup_callback, false);

    // input field handlers
    $("#subplot_letter_input").focus(input_field_focus).blur(input_field_blur);
    $("#vertical_splits_input").focus(input_field_focus).blur(input_field_blur);
    $("#horiz_splits_input").focus(input_field_focus).blur(input_field_blur);
    $("#canvas_width_input").focus(input_field_focus).blur(input_field_blur);
    $("#canvas_height_input").focus(input_field_focus).blur(input_field_blur);

    $("#subplot_letter_input").on('change input', update_subplot_letter);

    // store copy of state for undo actions later
    let state_copy = JSON.parse(JSON.stringify(figure_state));
    state_history.push(state_copy);

    draw();
  };

  // Button to add default cell
  var addButton = function() {
    Jupyter.toolbar.add_buttons_group([
      Jupyter.keyboard_manager.actions.register({
        'help': 'Add figure layout generator',
        'icon': 'fa-window-restore',
        'handler': add_cell
      }, 'add-default-cell', 'Default cell')
    ])
  }
  // Run on start
  function load_ipython_extension() {
    addButton();
  }
  return {
    load_ipython_extension: load_ipython_extension
  };
});