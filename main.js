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

  var canvas_width = 640;
  var canvas_height = 480;

  var start_x = -1;
  var start_y = -1;
  var end_x = -1;
  var end_y = -1;
  window.subplots = []

  var unselected_color = "#A0A0A0";
  var selected_color = "#FF0000";

  var state = "none";
  var clicked_subplot = -1;
  var clicked_corner = [-1, -1];
  var clicked_edge = "none";

  var current_letter = 'A';

  function mousedown_callback(event) {
    console.log("mousedown");
    let elem = document.getElementById('canv2');
    let rect = elem.getBoundingClientRect();

    let context = elem.getContext('2d');

    let states = ["none", "new", "move", "resize"];


    let rel_loc = getRelativeCoordinates(event, elem);
    start_x = rel_loc.x;
    start_y = rel_loc.y;

    var margin = 10;
    for (i = 0; i < window.subplots.length; i += 1) {
      let subplot = window.subplots[i];
      let x_bounds = [subplot.left, subplot.left + subplot.width];
      let y_bounds = [subplot.top, subplot.top + subplot.height];
      if (start_x > x_bounds[0] && start_x < x_bounds[1] && start_y > y_bounds[0] && start_y < y_bounds[1]) {
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

        break; // TODO do overlapping subplots make sense? like inset plots?
      }
    }

    let corner_was_clicked = clicked_corner[0] != -1 && clicked_corner[1] != -1;
    let edge_was_clicked = clicked_edge != "none";
    if (clicked_subplot >= 0) {
      if (corner_was_clicked || edge_was_clicked) {
        state = "resize";
      } else {
        state = "move";
      }
    } else {
      state = "new";
    }
  }

  function unselect(subplot) {
    subplot.color = unselected_color;
    subplot.selected = false;

    $("#edit_selected_subplot").hide();
  }

  function select(subplot) {
    console.log("Selecting subplot ", subplot.letter);
    subplot.color = selected_color;
    subplot.selected = !subplot.selected; // toggle selection

    $("#edit_selected_subplot").show();
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

      if (width < 15 && height < 15) {
        // clear selection,i.e. you can't make a tiny subplot
        for (let i = 0; i < window.subplots.length; i += 1) {
          unselect(window.subplots[i]);
        }
      } else {
        let subplot = create_new_subplot(Math.min(start_x, end_x), Math.min(start_y, end_y),
          width, height);
        window.subplots.push(subplot);

        // increment letter for next plot
        current_letter = String.fromCharCode(current_letter.charCodeAt(0) + 1);
      }
    } else if (state == "move") {
      displ_x = end_x - start_x;
      displ_y = end_y - start_y;

      var subplot = window.subplots[clicked_subplot];
      if (displ_x < 5 && displ_y < 5) {
        select(subplot);
      } else {
        // move action
        subplot.top += displ_y;
        subplot.left += displ_x;
      }
    } else if (state == "resize") {
      var subplot = window.subplots[clicked_subplot];
      let x_bounds = [subplot.left, subplot.left + subplot.width];
      let y_bounds = [subplot.top, subplot.top + subplot.height];

      let corner_was_clicked = clicked_corner[0] != -1 && clicked_corner[1] != -1;
      let edge_was_clicked = clicked_edge != "none";

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
    }

    clicked_subplot = -1;
    clicked_corner = [-1, -1];
    clicked_edge = "none";
    state = "none"

    draw();
  }

  function draw() {
    let elem = document.getElementById('canv2');
    let rect = elem.getBoundingClientRect();

    let context = elem.getContext('2d');    
    context.clearRect(0, 0, elem.width, elem.height);
    context.beginPath();

    for (let index = 0; index < window.subplots.length; index++) {
      var subplot = window.subplots[index];

      // draw object
      context.strokeStyle = subplot.color;
      context.strokeRect(subplot.left, subplot.top, subplot.width, subplot.height);

      // context.fillStyle = subplot.color;
      // context.fillRect(subplot.left, subplot.top, subplot.width, subplot.height);
      context.textAlign = "left";
      context.font = "16px Arial";
      context.fillText(subplot.letter, subplot.left, subplot.top);

      context.textAlign = "center";
      context.font = "10px Arial";
      context.fillText(subplot.annotation, subplot.left + subplot.width/2, subplot.top + subplot.height/2);
    }

    // 
    save();
  }

  function generate_code() {
    str = "import matplotlib.pyplot as plt\n%matplotlib notebook\n";
    str += "fig = plt.figure()\n";
    for (i = 0; i < window.subplots.length; i += 1) {
      subplot = window.subplots[i];

      let py_width = subplot.width / canvas_width;
      let py_height = subplot.height / canvas_height;
      let py_x0 = subplot.left / canvas_width;
      let py_y0 = 1 - (subplot.top / canvas_height) - py_height;

      str += `ax${subplot.letter} = fig.add_axes([${py_x0.toFixed(2)}, ${py_y0.toFixed(2)}, ${py_width.toFixed(2)}, ${py_height.toFixed(2)}])\n`;
      str += `fig.text(${py_x0.toFixed(2)}, ${(py_y0 + py_height).toFixed(2)}, "${subplot.letter}", fontsize=24, va='bottom', ha='right')\n`
    }

    // inject new cell into the notebook
    Jupyter.notebook.insert_cell_below('code').set_text(str);
  }

  function clear() {
    window.subplots = [];
    draw();
  }

  function save() {
    var curr_cell = Jupyter.notebook.get_selected_cell();
    curr_cell.set_text("# Select your plot below\n# subplots_data:\n# " + JSON.stringify(window.subplots));
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
    let horiz_splits = $("#horiz_splits").val();
    let vertical_splits = $("#vertical_splits").val();
    let idx = -1;
    console.log("splitting into " + horiz_splits + " by" + vertical_splits);
    for (let i = 0; i < window.subplots.length; i += 1) {
      if (window.subplots[i].selected) {
        let subplot = window.subplots[i];
        let x_bounds = [subplot.left, subplot.left + subplot.width];
        let y_bounds = [subplot.top, subplot.top + subplot.height];

        let new_width = (x_bounds[1] - x_bounds[0]) / horiz_splits;
        let new_height = (y_bounds[1] - y_bounds[0]) / vertical_splits;

        for (let kx = 0; kx < horiz_splits; kx += 1) {
          for (let ky = 0; ky < vertical_splits; ky += 1) {
            let new_subplot = create_new_subplot(x_bounds[0] + new_width*kx, y_bounds[0] + new_height*ky,
              new_width * 0.9, new_height * 0.9);
            window.subplots.push(new_subplot);            
            current_letter = String.fromCharCode(current_letter.charCodeAt(0) + 1);
          }
        }

        idx = i;
        break;
      }
    }    

    // remove the old subplot
    if (idx >= 0) {
      window.subplots.splice(idx, 1);
    }

    draw();
  }

  function update() {
    let new_letter = $("#subplots_update").val();
    for (let i = 0; i < window.subplots.length; i += 1) {
      if (window.subplots[i].selected) {
        window.subplots[i].letter = new_letter;
      }
    }
    draw();
  }

  document.addEventListener("keydown", event => {
    if (event.keyCode == 90 && event.ctrlKey) {
      window.subplots.pop();
      draw();
    }
  });

  var add_cell = function() {
    window.subplots = [];

    var curr_cell = Jupyter.notebook.get_selected_cell();
    var curr_text = curr_cell.get_text();

    if (curr_text.includes("# subplots_data:")) {
      let curr_text_lines = curr_text.split("\n");
      window.subplots = JSON.parse(curr_text_lines[curr_text_lines.length - 1].substring(2));
    } else {
      curr_cell.set_text(`# Select your plot below`);
    }

    Jupyter.notebook.select();
    Jupyter.notebook.execute_cell();

    // # get reference to the stuff 
    // Jupyter.notebook.select();
    var output_subarea = $("#notebook-container")
      .children('.selected')
      .children('.output_wrapper')
      .children('.output');


    // add event handlers
    var x = document.createElement("canvas");
    x.setAttribute("id", "canv2");
    x.setAttribute("style", "border:1px solid #000000;"); //  margin-left:150px
    x.setAttribute("width", canvas_width);
    x.setAttribute("clientWidth", canvas_width);
    x.setAttribute("height", canvas_height);

    var generate_button = document.createElement("BUTTON");
    generate_button.innerHTML = "Generate python cell"
    generate_button.addEventListener("click", generate_code, false);

    let clear_button = document.createElement("button");
    clear_button.innerHTML = "Clear";
    clear_button.addEventListener("click", clear, false);

    let div_selected = document.createElement("div");
    div_selected.setAttribute("id", "edit_selected_subplot");

    var input_field = document.createElement("INPUT");
    input_field.setAttribute("type", "text");
    input_field.setAttribute("id", "subplots_update");

    let update_button = document.createElement("button");
    update_button.innerHTML = "Update label";
    update_button.setAttribute("id", "update_button");
    update_button.addEventListener("click", update, false);

    var vertical_splits = document.createElement("INPUT");
    vertical_splits.setAttribute("type", "text");
    vertical_splits.setAttribute("id", "vertical_splits");    

    var vertical_split_label = document.createElement("label");
    vertical_split_label.innerHTML = "# of row splits";

    var horiz_splits = document.createElement("INPUT");
    horiz_splits.setAttribute("type", "text");
    horiz_splits.setAttribute("id", "horiz_splits");        

    var horiz_split_label = document.createElement("label");
    horiz_split_label.innerHTML = "# of column splits";    

    let split_button = document.createElement("button");
    split_button.innerHTML = "Split selected subplot";
    split_button.setAttribute("id", "split_button");
    split_button.addEventListener("click", split_subplot, false);

    let div = document.createElement("div")
    div.appendChild(generate_button);
    div.appendChild(clear_button);
    div.appendChild(document.createElement("br"));
    // div.appendChild(save_button);
    div_selected.appendChild(input_field);
    div_selected.appendChild(update_button);
    div_selected.appendChild(document.createElement("br"));
    div_selected.appendChild(vertical_split_label);
    div_selected.appendChild(vertical_splits);
    div_selected.appendChild(horiz_split_label);
    div_selected.appendChild(horiz_splits);
    div_selected.appendChild(split_button);
    div.appendChild(div_selected);
    div.appendChild(x);

    output_subarea[0].appendChild(div);

    div.setAttribute("style", "margin-left:150px;");

    // start elements as hidden if they are related to selecting a subplot
    $("#edit_selected_subplot").hide();

    var elem = document.getElementById('canv2');
    console.log(elem)
    elem.width = canvas_width;
    elem.height = canvas_height;

    elem.addEventListener('mousedown', mousedown_callback, false);
    elem.addEventListener('mouseup', mouseup_callback, false);

    // input field handlers
    $("#subplots_update").focus(input_field_focus).blur(input_field_blur);
    $("#vertical_splits").focus(input_field_focus).blur(input_field_blur);
    $("#horiz_splits").focus(input_field_focus).blur(input_field_blur);

    draw();
  };

  // Button to add default cell
  var addButton = function() {
    Jupyter.toolbar.add_buttons_group([
      Jupyter.keyboard_manager.actions.register({
        'help': 'Add figure layout generator',
        'icon': 'fa-play-circle',
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