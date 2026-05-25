/**
 * @file mrf.c
 * @author David Dewhurst (david@drdewhurst.com)
 * @brief 
 * @version 0.1
 * @date 2024-01-13
 * 
 * @copyright Copyright (c) 2024, D R Dewhurst, Inc.
 * 
 */

#include "stdlib.h"

#include "mrf.h"

struct Message *
new_message_unassigned(int dim) {
    double * values = (double *) malloc(sizeof(double) * dim);
    struct Message * msg = (struct Message *) malloc(sizeof(struct Message));
    msg->values = values;
    msg->dim = dim;
    return msg;
}

struct Message *
new_message(int dim, int from, int to) {
    struct Message * msg = new_message_unassigned(dim);
    msg->from = from;
    msg->to = to;
    return msg;
}

void
delete_message(struct Message * msg) {
    free(msg->values);
    free(msg);
}

// initial message

struct Message *
new_message_unit(int dim, int from, int to) {
    struct Message * msg = new_message(dim, from, to);
    for (int ix = 0; ix != dim; ++ix) {
        msg->values[ix] = 1.0;
    }
    return msg;
}

void increment_recv_ctr(struct Node * n) {
    n->recv_ix = (n->recv_ix + 1) % n->degree;
}

void initialize_messages(struct Node * n) {
    for (int ix = 0; ix != n->degree; ++ix) {
        n->inbox[n->recv_ix] = new_message_unit(n->dim, 0, 0);
        increment_recv_ctr(n);
    }
}

void delete_messages(struct Node * n) {
    for (int ix = 0; ix != n->degree; ++ix) {
        delete_message(n->inbox[ix]);
    }
}

struct Node * 
new_node(int id, int degree, int dim){
    struct Node ** neighbors = (struct Node **) malloc(sizeof(struct Node *) * degree);
    struct Message ** inbox = (struct Message **) malloc(sizeof(struct Message *) * degree);
    struct Factor2D ** factor2d = (struct Factor2D **) malloc(sizeof(struct Factor2D *) * degree);
    struct Node * node = (struct Node *) malloc(sizeof(struct Node));
    node->neighbors = neighbors;
    node->inbox = inbox;
    node->factor2d = factor2d;
    node->id = id;
    node->degree = degree;
    node->dim = dim;
    node->connect_ix = 0;
    node->recv_ix = 0;

    initialize_messages(node);

    return node;
}

void
delete_node(struct Node * node) {
    free(node->neighbors);
    delete_messages(node);
    free(node->inbox);
    free(node->factor2d);
    free(node);
}

struct Factor1D *
new_factor1d(int dim) {
    double * values = (double *) malloc(sizeof(double) * dim);
    struct Factor1D * fac = (struct Factor1D *) malloc(sizeof(struct Factor1D));
    fac->values = values;
    fac->dim = dim;
    return fac;
}

void delete_factor1d(struct Factor1D * fac) {
    free(fac->values);
    free(fac);
}

struct Factor2D *
new_factor2d(int rows, int cols) {
    double * values = (double *) malloc(sizeof(double) * rows * cols);
    struct Factor2D * fac = (struct Factor2D *) malloc(sizeof(struct Factor2D));
    fac->values = values;
    fac->rows = rows;
    fac->cols = cols;
    return fac;
}

void delete_factor2d(struct Factor2D * fac) {
    free(fac->values);
    free(fac);
}

// index into message

double message_at(struct Message * msg, int ix) {
    if (ix >= msg->dim || ix < 0) return -1.0;
    return msg->values[ix];
}
void message_ix(struct Message * msg, int ix, double value) {
    if (ix >= msg->dim || ix < 0) return;
    msg->values[ix] = value;
}

// index into factors
double factor1d_at(struct Factor1D * fac, int ix) {
    if (ix >= fac->dim || ix < 0) return -1.0;
    return fac->values[ix];
}
void factor1d_ix(struct Factor1D * fac, int ix, double value) {
    if (ix >= fac->dim || ix < 0) return;
    fac->values[ix] = value;
}

double factor2d_at(struct Factor2D * fac, int row, int col) {
    if (row >= fac->rows || row < 0) return -1.0;
    if (col >= fac->cols || col < 0) return -1.0;
    return fac->values[row * fac->cols + col];
}
void factor2d_ix(struct Factor2D * fac, int row, int col, double value) {
    if (row >= fac->rows || row < 0) return;
    if (col >= fac->cols || col < 0) return;
    fac->values[row * fac->cols + col] = value;
}

// evidence

void set_evidence_factor1d(struct Factor1D * fac, int index) {
    for (int ix = 0; ix != fac->dim; ++ix) {
        if (ix != index) factor1d_ix(fac, ix, 0.0);
    }
}

void set_evidence_factor2d_col(struct Factor2D * fac, int index) {
    for (int col_ix = 0; col_ix != fac->cols; ++col_ix) {
        if (col_ix != index) {
            for (int row_ix = 0; row_ix != fac->rows; ++row_ix) {
                factor2d_ix(fac, row_ix, col_ix, 0.0);
            }
        }
    }
}

void set_evidence_factor2d_row(struct Factor2D * fac, int index) {
    for (int row_ix = 0; row_ix != fac->rows; ++row_ix) {
        if (row_ix != index) {
            for (int col_ix = 0; col_ix != fac->cols; ++col_ix) {
                factor2d_ix(fac, row_ix, col_ix, 0.0);
            }
        }
    }
}

void set_evidence(struct Node * n, int value) {
    set_evidence_factor1d(n->factor1d, value);
    // for all neighbors, lower effective dimension of Factor2D to 1d
    // by setting columns / rows that don't correspond to value to zero
    for (int n_ix = 0; n_ix != n->degree; ++n_ix) {
        struct Factor2D * fac = n->factor2d[n_ix];
        if (n->id == fac->col_id) {
            set_evidence_factor2d_col(fac, value);
        } else {
            set_evidence_factor2d_row(fac, value);
        }
    }
}

// uniform distributions

struct Factor1D *
new_factor1d_uniform_prior(int dim) {
    struct Factor1D * fac = new_factor1d(dim);
    for (int ix = 0; ix != dim; ++ix) {
        fac->values[ix] = 1.0 / dim;
    }
    return fac;
}

struct Factor2D *
new_factor2d_uniform_prior(int rows, int cols) {
    struct Factor2D * fac = new_factor2d(rows, cols);
    int rc = rows * cols;
    for (int ix = 0; ix != rc; ++ix) {
        fac->values[ix] = 1.0 / rc;
    }
    return fac;
}

// graph structure

void increment_connect_ctr(struct Node * n) {
    n->connect_ix = (n->connect_ix + 1) % n->degree;
}

void connect_nodes(struct Node * n1, struct Node * n2, struct Factor2D * fac) {
    n1->neighbors[n1->connect_ix] = n2;
    n2->neighbors[n2->connect_ix] = n1;
    n1->factor2d[n1->connect_ix] = fac;
    n2->factor2d[n2->connect_ix] = fac;
    fac->row_id = n1->id;
    fac->col_id = n2->id;
    // n2 -> n1
    n1->inbox[n1->connect_ix]->from = n2->id;
    n1->inbox[n1->connect_ix]->to = n1->id;
    // n1 -> n2
    n2->inbox[n2->connect_ix]->from = n1->id;
    n2->inbox[n2->connect_ix]->to = n2->id;
    increment_connect_ctr(n1);
    increment_connect_ctr(n2);
}

void connect_factor1d(struct Node * n, struct Factor1D * fac) {
    n->factor1d = fac;
}

// inference

void reset_messages(struct Node * n) {
    for (int ix = 0; ix != n->degree; ++ix) {
        struct Message * msg = n->inbox[ix];
        for (int v = 0; v != msg->dim; ++v) {
            message_ix(msg, v, 1.0);
        }
    }
}

void message_product(struct Node * from, struct Node * to, struct Message * out_msg) {
    // dimensions of messages are equal to the from dimension
    // product of messages from all neighbors except for to
    for (int msg_ix = 0; msg_ix != from->degree; ++msg_ix) {
        struct Message * this_msg = from->inbox[msg_ix];
        if (this_msg->from != to->id) {
            for (int enum_ix = 0; enum_ix != from->dim; ++enum_ix) {
                out_msg->values[enum_ix] *= this_msg->values[enum_ix];
            }
        }
    }
    out_msg->from = from->id;
    out_msg->to = to->id;
}

void all_message_product(struct Node * node, struct Message * out_msg) {
    for (int msg_ix = 0; msg_ix != node->degree; ++msg_ix) {
        struct Message * this_msg = node->inbox[msg_ix];
        for (int enum_ix = 0; enum_ix != node->dim; ++enum_ix) {
            out_msg->values[enum_ix] *= this_msg->values[enum_ix];
        }
    }
}

/**
 * @brief 
 * 
 * \todo use a different data structure than an unsorted edge list!
 * 
 * @param from 
 * @param to 
 * @return struct Factor2D* 
 */
struct Factor2D *
find_factor2d(struct Node * from, int to) {
    for (int ix = 0; ix != from->degree; ++ix) {
        struct Factor2D * fac = from->factor2d[ix];
        if (fac->col_id == to || fac->row_id == to) {
            return fac;
        }
    }
}

void sum_out_row(struct Node * from, struct Message * prod, struct Message * out_msg) {
    // sum along the row, i.e., the first dimension in factor2d
    struct Factor2D * fac = find_factor2d(from, out_msg->to);
    for (int col_ix = 0; col_ix != fac->cols; ++col_ix) {
        double value = 0.0;
        for (int row_ix = 0; row_ix != fac->rows; ++row_ix) {
            value += factor2d_at(fac, row_ix, col_ix) * factor1d_at(from->factor1d, row_ix) * prod->values[row_ix];
        }
        out_msg->values[col_ix] = value;
    }
}

void sum_out_col(struct Node * from, struct Message * prod, struct Message * out_msg) {
    // sum along the column, i.e. the second dimension in factor2d
    struct Factor2D * fac = find_factor2d(from, out_msg->to);
    for (int row_ix = 0; row_ix != fac->rows; ++row_ix) {
        double value = 0.0;
        for (int col_ix = 0; col_ix != fac->cols; ++col_ix) {
            value += factor2d_at(fac, row_ix, col_ix) * factor1d_at(from->factor1d, col_ix) * prod->values[col_ix];
        }
        out_msg->values[row_ix] = value;
    }
}

void normalize_message(struct Message * msg) {
    double sum = 0.0;
    for (int ix = 0; ix != msg->dim; ++ix) sum += msg->values[ix];
    for (int ix = 0; ix != msg->dim; ++ix) msg->values[ix] /= sum;
}

void compute_message(struct Node * from, struct Node * to, struct Message * out_msg) {
    // out_msg has "to" dims
    // we will create an intermediary that has "from" dims
    struct Message * prod = new_message_unit(from->dim, from->id, to->id);
    message_product(from, to, prod);
    // now we marginalize out the univariate and bivariate factors
    struct Factor2D * fac = find_factor2d(from, out_msg->to);
    if (from->id == fac->col_id) {
        sum_out_col(from, prod, out_msg);
    } else {
        sum_out_row(from, prod, out_msg);
    }   
    normalize_message(out_msg);
    delete_message(prod);
}

void send_messages(struct Node * from) {
    for (int ix = 0; ix != from->degree; ++ix) {
        struct Node * to = from->neighbors[ix];
        compute_message(from, to, to->inbox[to->recv_ix]);
        increment_recv_ctr(to);
    }
}

void compute_univariate_marginal(struct Node * node, struct Factor1D * out) {
    struct Message * msg = new_message_unit(node->dim, 0, 0);
    all_message_product(node, msg);
    double normalizer = 0.0;
    for (int ix = 0; ix != node->dim; ++ix) {
        out->values[ix] = msg->values[ix] * node->factor1d->values[ix];
        normalizer += out->values[ix];
    }
    for (int ix = 0; ix != node->dim; ++ix) {
        out->values[ix] /= normalizer;
    }
    delete_message(msg);
}

void bp(struct Node ** nodes, int num_nodes, int num_iterations) {
    for (int ix = 0; ix != num_nodes; ++ix) {
        reset_messages(nodes[ix]);
    }
    for (int iter = 0; iter != num_iterations; ++iter) {
        for (int ix = 0; ix != num_nodes; ++ix) {
            send_messages(nodes[ix]);
        }
    }
}
