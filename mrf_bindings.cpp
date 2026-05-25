// mrf_bindings.cpp
#include <emscripten/bind.h>
#include "mrf.h"
#include <vector>
#include <string>
#include <map>
#include <cstdint>

using namespace emscripten;

// --- Registry ---
static std::map<int, struct Node*> node_registry;

void register_node(int id, struct Node* node) { node_registry[id] = node; }
void unregister_node(int id) { node_registry.erase(id); }
struct Node* get_node(int id) {
    auto it = node_registry.find(id);
    return (it != node_registry.end()) ? it->second : nullptr;
}

void bp_by_ids(emscripten::val nodeIdsVal, int num_iterations) {
    // Convert JS array to C++ vector
    const int num_nodes = nodeIdsVal["length"].as<int>();
    std::vector<int> node_ids(num_nodes);
    for (int i = 0; i < num_nodes; i++) {
        node_ids[i] = nodeIdsVal[i].as<int>();
    }

    std::vector<struct Node*> nodes;
    nodes.reserve(node_ids.size());
    for (int id : node_ids) {
        struct Node* n = get_node(id);
        if (!n) throw std::runtime_error("Node ID " + std::to_string(id) + " not found");
        nodes.push_back(n);
    }
    bp(nodes.data(), nodes.size(), num_iterations);
}

// --- Wrapper functions using uintptr_t instead of raw pointers ---
// Embind understands uintptr_t (it's just an integer), avoiding all pointer binding issues.

// Node
uintptr_t w_new_node(int id, int degree, int dim) {
    return reinterpret_cast<uintptr_t>(new_node(id, degree, dim));
}
void w_delete_node(uintptr_t p) { delete_node(reinterpret_cast<Node*>(p)); }
int w_node_id(uintptr_t p) { return reinterpret_cast<Node*>(p)->id; }
int w_node_degree(uintptr_t p) { return reinterpret_cast<Node*>(p)->degree; }
int w_node_dim(uintptr_t p) { return reinterpret_cast<Node*>(p)->dim; }

// Factor1D
uintptr_t w_new_factor1d(int dim) {
    return reinterpret_cast<uintptr_t>(new_factor1d(dim));
}
uintptr_t w_new_factor1d_uniform(int dim) {
    return reinterpret_cast<uintptr_t>(new_factor1d_uniform_prior(dim));
}
void w_delete_factor1d(uintptr_t p) { delete_factor1d(reinterpret_cast<Factor1D*>(p)); }
int w_f1d_dim(uintptr_t p) { return reinterpret_cast<Factor1D*>(p)->dim; }
double w_f1d_at(uintptr_t p, int i) { return factor1d_at(reinterpret_cast<Factor1D*>(p), i); }
void w_f1d_set(uintptr_t p, int i, double v) { factor1d_ix(reinterpret_cast<Factor1D*>(p), i, v); }

// Factor2D
uintptr_t w_new_factor2d(int rows, int cols) {
    return reinterpret_cast<uintptr_t>(new_factor2d(rows, cols));
}
uintptr_t w_new_factor2d_uniform(int rows, int cols) {
    return reinterpret_cast<uintptr_t>(new_factor2d_uniform_prior(rows, cols));
}
void w_delete_factor2d(uintptr_t p) { delete_factor2d(reinterpret_cast<Factor2D*>(p)); }
int w_f2d_rows(uintptr_t p) { return reinterpret_cast<Factor2D*>(p)->rows; }
int w_f2d_cols(uintptr_t p) { return reinterpret_cast<Factor2D*>(p)->cols; }
int w_f2d_row_id(uintptr_t p) { return reinterpret_cast<Factor2D*>(p)->row_id; }
int w_f2d_col_id(uintptr_t p) { return reinterpret_cast<Factor2D*>(p)->col_id; }
double w_f2d_at(uintptr_t p, int r, int c) { return factor2d_at(reinterpret_cast<Factor2D*>(p), r, c); }
void w_f2d_set(uintptr_t p, int r, int c, double v) { factor2d_ix(reinterpret_cast<Factor2D*>(p), r, c, v); }

// Connections
void w_connect_nodes(uintptr_t n1, uintptr_t n2, uintptr_t fac) {
    connect_nodes(reinterpret_cast<Node*>(n1), reinterpret_cast<Node*>(n2), reinterpret_cast<Factor2D*>(fac));
}
void w_connect_factor1d(uintptr_t n, uintptr_t fac) {
    connect_factor1d(reinterpret_cast<Node*>(n), reinterpret_cast<Factor1D*>(fac));
}

// Inference
void w_set_evidence(uintptr_t n, int value) {
    set_evidence(reinterpret_cast<Node*>(n), value);
}
void w_reset_messages(uintptr_t n) {
    reset_messages(reinterpret_cast<Node*>(n));
}
void w_compute_univariate_marginal(uintptr_t node, uintptr_t out) {
    compute_univariate_marginal(reinterpret_cast<Node*>(node), reinterpret_cast<Factor1D*>(out));
}

// Registry
void w_register_node(int id, uintptr_t p) {
    register_node(id, reinterpret_cast<Node*>(p));
}

EMSCRIPTEN_BINDINGS(mrf_module) {

    // Node
    function("new_node", &w_new_node);
    function("delete_node", &w_delete_node);
    function("get_node_id", &w_node_id);
    function("get_node_degree", &w_node_degree);
    function("get_node_dim", &w_node_dim);

    // Factor1D
    function("new_factor1d", &w_new_factor1d);
    function("new_factor1d_uniform_prior", &w_new_factor1d_uniform);
    function("delete_factor1d", &w_delete_factor1d);
    function("get_factor1d_dim", &w_f1d_dim);
    function("get_factor1d_at", &w_f1d_at);
    function("set_factor1d_at", &w_f1d_set);

    // Factor2D
    function("new_factor2d", &w_new_factor2d);
    function("new_factor2d_uniform_prior", &w_new_factor2d_uniform);
    function("delete_factor2d", &w_delete_factor2d);
    function("get_factor2d_rows", &w_f2d_rows);
    function("get_factor2d_cols", &w_f2d_cols);
    function("get_factor2d_row_id", &w_f2d_row_id);
    function("get_factor2d_col_id", &w_f2d_col_id);
    function("get_factor2d_at", &w_f2d_at);
    function("set_factor2d_at", &w_f2d_set);

    // Connections
    function("connect_nodes", &w_connect_nodes);
    function("connect_factor1d", &w_connect_factor1d);

    // Inference
    function("set_evidence", &w_set_evidence);
    function("reset_messages", &w_reset_messages);
    function("compute_univariate_marginal", &w_compute_univariate_marginal);
    function("run_belief_propagation", &bp_by_ids);

    // Registry
    function("_register_node", &w_register_node);
    function("_unregister_node", &unregister_node);
}